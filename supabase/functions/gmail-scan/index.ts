const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `Eres un experto en leer correos de confirmación de compra de tiendas online (Temu, AliExpress, Shein, Amazon).

Tu tarea: Del siguiente correo, extrae CADA producto comprado. Devuelve un JSON array.

Campos requeridos por producto:
{
  "productName": "nombre real del producto tal como aparece en el correo",
  "store": "Temu" | "AliExpress" | "Shein" | "Amazon",
  "pricePaid": 12.99,
  "orderNumber": "123456",
  "orderDate": "2026-02-20",
  "estimatedArrival": "2026-03-15",
  "unitsOrdered": 1,
  "productImageUrl": "la URL de imagen del producto si está disponible",
  "isOrder": true
}

REGLAS:
- productName DEBE ser el nombre real del artículo. NUNCA escribas "Product", "Pedido", "Item" u otro texto genérico.
- Si hay una lista de "IMAGE_URLS" al final, asocia cada imagen con su producto correspondiente (en orden).
- store: detecta del remitente (@temu.com = Temu, etc.)
- Si es un correo PROMOCIONAL o de marketing (no una confirmación de compra real), devuelve []
- isOrder: true para compras reales, false para marketing

Devuelve SOLO un JSON array válido. Sin markdown, sin explicación.`;

// Strip HTML tags to get clean text, preserving structure
function htmlToText(html: string): string {
  return html
    // Replace <br>, <p>, <div>, <tr>, <li> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|td|h[1-6])>/gi, '\n')
    .replace(/<(p|div|tr|li|td|h[1-6])[^>]*>/gi, '')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    // Clean up whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// Extract product image URLs from HTML
function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    // Only keep product images from known CDNs, skip tiny icons/tracking
    if (
      (url.includes('kwcdn.com') || url.includes('alicdn.com') ||
       url.includes('ltwebstatic.com') || url.includes('ssl-images-amazon.com') ||
       url.includes('m.media-amazon.com')) &&
      !url.includes('1x1') && !url.includes('pixel') && !url.includes('spacer')
    ) {
      urls.push(url);
    }
  }
  // Deduplicate
  return [...new Set(urls)];
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Token refresh failed:', JSON.stringify(data));
    throw new Error('Failed to refresh token.');
  }
  return data.access_token;
}

async function getEmails(accessToken: string, dateFrom: string, dateTo: string): Promise<any[]> {
  // Broad query - just FROM these stores, no subject filter
  const query = encodeURIComponent(
    `from:(aliexpress OR shein OR temu OR amazon) after:${dateFrom} before:${dateTo}`
  );

  console.log('Gmail query:', decodeURIComponent(query));

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=30`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.json();
    console.error('Gmail list error:', JSON.stringify(err));
    throw new Error(`Gmail API: ${err.error?.message || 'Unknown'}`);
  }

  const listData = await listRes.json();
  if (!listData.messages?.length) return [];

  console.log(`Found ${listData.messages.length} emails, fetching up to 20...`);

  const emails = await Promise.all(
    listData.messages.slice(0, 20).map(async (msg: any) => {
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return msgRes.json();
    })
  );

  return emails;
}

function extractEmailParts(message: any): { subject: string; from: string; plainText: string; htmlBody: string } {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
  const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';

  let plainText = '';
  let htmlBody = '';

  function walk(part: any): void {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plainText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(message.payload);
  return { subject, from, plainText, htmlBody };
}

async function extractOrdersFromEmail(
  apiKey: string,
  email: { subject: string; from: string; plainText: string; htmlBody: string }
): Promise<any[]> {
  // Convert HTML to clean text for the AI
  const cleanText = htmlToText(email.htmlBody);
  // Extract image URLs separately
  const imageUrls = extractImageUrls(email.htmlBody);

  const emailContent = `REMITENTE: ${email.from}
ASUNTO: ${email.subject}

CONTENIDO DEL CORREO (texto limpio):
${cleanText.slice(0, 8000)}

IMAGE_URLS encontradas en el correo (asociar con productos en orden):
${imageUrls.length > 0 ? imageUrls.slice(0, 10).join('\n') : 'Ninguna encontrada'}`;

  console.log(`  Sending to AI: ${emailContent.length} chars, ${imageUrls.length} images`);

  const aiResponse = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: emailContent },
      ],
      temperature: 0.1,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error(`AI error for "${email.subject}":`, errText);
    return [];
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content || '';

  try {
    let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const orders = JSON.parse(jsonMatch[0]);
    return orders.filter((o: any) => o.isOrder !== false && o.isPurchaseConfirmation !== false);
  } catch {
    console.error(`Parse error for "${email.subject}":`, content.slice(0, 200));
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI no configurado.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessToken, refreshToken, dateFrom, dateTo } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No hay token. Reconecta Gmail.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let token = accessToken;

    const testRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!testRes.ok && refreshToken) {
      console.log('Refreshing token...');
      try {
        token = await refreshAccessToken(refreshToken);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Token expirado. Reconecta Gmail.', needsReconnect: true }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (!testRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token expirado. Reconecta Gmail.', needsReconnect: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = dateFrom || defaultFrom.toISOString().split('T')[0];
    const toDate = dateTo || now.toISOString().split('T')[0];

    console.log(`Scanning ${fromDate} to ${toDate}`);

    const emails = await getEmails(token, fromDate, toDate);
    if (!emails.length) {
      return new Response(
        JSON.stringify({ success: true, orders: [], message: `Sin correos entre ${fromDate} y ${toDate}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailParts = emails.map(extractEmailParts);

    console.log(`Processing ${emailParts.length} emails individually...`);
    emailParts.forEach((e, i) => console.log(`  [${i+1}] ${e.from.slice(0, 35)} | ${e.subject.slice(0, 60)}`));

    // Process each email individually with the stronger model
    const allOrders: any[] = [];
    for (const email of emailParts) {
      console.log(`\nProcessing: "${email.subject.slice(0, 70)}"`);
      const orders = await extractOrdersFromEmail(apiKey, email);
      if (orders.length > 0) {
        console.log(`  ✓ ${orders.length} producto(s):`, orders.map((o: any) => `"${o.productName?.slice(0, 40)}" $${o.pricePaid}`).join(' | '));
        allOrders.push(...orders);
      } else {
        console.log(`  ✗ No es compra / promocional`);
      }
    }

    console.log(`\nTotal: ${allOrders.length} pedidos extraídos`);

    return new Response(
      JSON.stringify({
        success: true,
        orders: allOrders,
        newAccessToken: token !== accessToken ? token : undefined,
        dateRange: { from: fromDate, to: toDate },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: `Error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
