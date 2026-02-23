const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `You are an expert at reading retail purchase confirmation emails and extracting product data.

Your task: From this SINGLE email, extract every product that was purchased. Return a JSON array.

Each product object MUST have:
{
  "productName": "the real product name/title as written in the email",
  "store": "AliExpress" | "Shein" | "Temu" | "Amazon",
  "pricePaid": 12.99,
  "orderNumber": "8123456789",
  "orderDate": "2026-02-20",
  "estimatedArrival": "2026-03-15",
  "unitsOrdered": 1,
  "pricePerUnit": 12.99,
  "productImageUrl": "https://...",
  "isPurchaseConfirmation": true
}

HOW TO FIND THE PRODUCT NAME:
- In Temu emails: Look inside HTML table cells (<td>) near the product image. The name is usually in a <span> or <a> tag near an <img> with kwcdn.com URL. It could be in Spanish or English.
- In AliExpress emails: Look for text in <td> or <div> near alicdn.com images. Product titles are usually long and descriptive.
- In Shein emails: Look for item descriptions near ltwebstatic.com images.
- In Amazon emails: Look for item names near ssl-images-amazon.com images.
- NEVER return generic names like "Product", "Pedido", "Order", "Item", "Producto". If you truly cannot find the name, use the email subject line.

HOW TO FIND THE IMAGE URL:
- Look for <img> tags with src URLs from: kwcdn.com, alicdn.com, ltwebstatic.com, ssl-images-amazon.com, m.media-amazon.com
- Pick the product thumbnail, not logos or icons

HOW TO DETECT THE STORE:
- Check the "From" header: @temu.com, @aliexpress.com, @shein.com, @amazon.com
- Also check email content for store branding

IMPORTANT:
- Only extract from REAL purchase confirmations, shipping confirmations, or order receipts
- IGNORE promotional/marketing emails - return [] for those
- If the email has multiple products, return one object per product
- isPurchaseConfirmation must be true for real orders, false for marketing

Return ONLY a valid JSON array. No markdown, no explanation.`;

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
    throw new Error('Failed to refresh token. Please reconnect Gmail.');
  }
  return data.access_token;
}

async function getEmails(accessToken: string, dateFrom: string, dateTo: string, maxResults = 30): Promise<any[]> {
  // Much broader query - just look for emails FROM these stores, no subject filter
  const query = encodeURIComponent(
    `from:(aliexpress OR shein OR temu OR amazon) after:${dateFrom} before:${dateTo}`
  );

  console.log('Gmail search query:', decodeURIComponent(query));

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.json();
    console.error('Gmail list error:', JSON.stringify(err));
    throw new Error(`Gmail API error: ${err.error?.message || 'Unknown'}`);
  }

  const listData = await listRes.json();
  if (!listData.messages?.length) return [];

  console.log(`Found ${listData.messages.length} emails, fetching up to 15...`);

  // Fetch each message with full format
  const emails = await Promise.all(
    listData.messages.slice(0, 15).map(async (msg: any) => {
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return msgRes.json();
    })
  );

  return emails;
}

function extractEmailContent(message: any): { subject: string; from: string; body: string; htmlBody: string } {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
  const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';

  let body = '';
  let htmlBody = '';

  function extractText(part: any): void {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.parts) {
      part.parts.forEach(extractText);
    }
  }

  extractText(message.payload);

  return { subject, from, body: body.slice(0, 4000), htmlBody };
}

async function extractOrdersFromEmail(
  apiKey: string,
  email: { subject: string; from: string; body: string; htmlBody: string }
): Promise<any[]> {
  // Send a generous chunk of HTML - this is where the product names and images live
  const htmlChunk = email.htmlBody.slice(0, 12000);
  
  const prompt = `From: ${email.from}
Subject: ${email.subject}

Plain text:
${email.body}

HTML content (contains product names and image URLs):
${htmlChunk}`;

  const aiResponse = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: prompt },
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
    // Clean markdown wrappers
    let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const orders = JSON.parse(jsonMatch[0]);
    return orders.filter((o: any) => o.isPurchaseConfirmation !== false);
  } catch {
    console.error(`Failed to parse AI response for "${email.subject}":`, content.slice(0, 300));
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
        JSON.stringify({ success: false, error: 'AI no configurado. Contacta al administrador.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessToken, refreshToken, dateFrom, dateTo } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se proporcionó token de acceso. Reconecta Gmail.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let token = accessToken;

    const testRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!testRes.ok && refreshToken) {
      console.log('Access token expired, refreshing...');
      try {
        token = await refreshAccessToken(refreshToken);
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token expirado. Por favor reconecta Gmail.', needsReconnect: true }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (!testRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token expirado. Por favor reconecta Gmail.', needsReconnect: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = dateFrom || defaultFrom.toISOString().split('T')[0];
    const toDate = dateTo || now.toISOString().split('T')[0];

    console.log(`Scanning emails from ${fromDate} to ${toDate}`);

    const emails = await getEmails(token, fromDate, toDate);
    if (!emails.length) {
      return new Response(
        JSON.stringify({ success: true, orders: [], message: `No se encontraron correos de pedidos entre ${fromDate} y ${toDate}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract content from each email
    const emailContents = emails.map(extractEmailContent);
    
    console.log(`Processing ${emailContents.length} emails individually with AI...`);
    console.log('Email subjects:', emailContents.map(e => `${e.from.slice(0,30)} | ${e.subject.slice(0,60)}`).join('\n'));

    // Process each email INDIVIDUALLY for much better extraction
    const allOrders: any[] = [];
    for (const email of emailContents) {
      console.log(`Processing: "${email.subject.slice(0, 80)}" from ${email.from.slice(0, 40)}`);
      const orders = await extractOrdersFromEmail(apiKey, email);
      if (orders.length > 0) {
        console.log(`  → Found ${orders.length} order(s):`, orders.map((o: any) => `${o.productName?.slice(0, 50)} ($${o.pricePaid})`).join(', '));
        allOrders.push(...orders);
      } else {
        console.log(`  → No orders (likely promotional)`);
      }
    }

    console.log(`Total orders found: ${allOrders.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        orders: allOrders, 
        newAccessToken: token !== accessToken ? token : undefined,
        dateRange: { from: fromDate, to: toDate }
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
