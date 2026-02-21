const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `You are an order data extractor analyzing email content. Extract order information and return a JSON array of orders found.

Each order object should have:
- productName: string (the specific product name, be descriptive)
- store: "AliExpress" | "Shein" | "Temu" | "Amazon" | null
- pricePaid: number | null (total price paid)
- orderNumber: string | null
- orderDate: string | null (YYYY-MM-DD)
- estimatedArrival: string | null (YYYY-MM-DD)
- unitsOrdered: number | null
- pricePerUnit: number | null
- productImageUrl: string | null (extract any product image URL from the email HTML if available)
- isPurchaseConfirmation: boolean (true ONLY if this is a purchase/order confirmation or shipping notification, false for marketing/ads/promotions)

IMPORTANT: Only extract REAL orders/purchases. Ignore:
- Promotional/marketing emails
- Wishlist notifications
- Price drop alerts
- Cart abandonment emails
- Newsletter emails

Return ONLY valid JSON array. If no real orders found, return [].
Detect store from sender email, subject, or content. Common senders:
- AliExpress: noreply@aliexpress.com, transaction@notice.aliexpress.com
- Shein: info@shein.com
- Temu: noreply@temu.com
- Amazon: auto-confirm@amazon.com, ship-confirm@amazon.com, digital-no-reply@amazon.com`;

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

async function getEmails(accessToken: string, dateFrom: string, dateTo: string, maxResults = 20): Promise<any[]> {
  // Build date filter using Gmail's after/before syntax
  const query = encodeURIComponent(
    `from:(aliexpress OR shein OR temu OR amazon) subject:(order OR pedido OR shipped OR enviado OR confirmation OR confirmación OR compra OR purchase) after:${dateFrom} before:${dateTo}`
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

  console.log(`Found ${listData.messages.length} emails, fetching up to 10...`);

  // Fetch each message with full format to get HTML for images
  const emails = await Promise.all(
    listData.messages.slice(0, 10).map(async (msg: any) => {
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
  
  // Extract image URLs from HTML
  const imageUrls: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(htmlBody)) !== null) {
    const url = match[1];
    // Filter for product images (skip tracking pixels, icons, etc.)
    if (url.includes('product') || url.includes('item') || url.includes('img') || 
        (url.includes('http') && !url.includes('tracking') && !url.includes('pixel') && 
         !url.includes('spacer') && !url.includes('1x1') && !url.includes('beacon'))) {
      imageUrls.push(url);
    }
  }

  // Limit body to prevent token overflow
  body = body.slice(0, 3000);
  const imageInfo = imageUrls.length > 0 ? `\nProduct image URLs found: ${imageUrls.slice(0, 5).join(', ')}` : '';

  return { subject, from, body: body + imageInfo, htmlBody: htmlBody.slice(0, 2000) };
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

    // Try to use access token, refresh if needed
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

    // Use provided dates or default to last 7 days
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = dateFrom || defaultFrom.toISOString().split('T')[0];
    const toDate = dateTo || now.toISOString().split('T')[0];

    console.log(`Scanning emails from ${fromDate} to ${toDate}`);

    // Fetch emails
    const emails = await getEmails(token, fromDate, toDate);
    if (!emails.length) {
      return new Response(
        JSON.stringify({ success: true, orders: [], message: `No se encontraron correos de pedidos entre ${fromDate} y ${toDate}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract content from emails
    const emailContents = emails.map(extractEmailContent);
    const emailSummary = emailContents
      .map((e, i) => `--- Email ${i + 1} ---\nFrom: ${e.from}\nSubject: ${e.subject}\n${e.body}`)
      .join('\n\n');

    console.log(`Processing ${emails.length} emails with AI...`);

    // Use AI to extract order data
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
          { role: 'user', content: `Extract orders from these emails:\n\n${emailSummary}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const aiErr = await aiResponse.text();
      console.error('AI error:', aiErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar los correos con IA. Intenta de nuevo.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let orders = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      orders = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      // Filter only real purchase confirmations
      orders = orders.filter((o: any) => o.isPurchaseConfirmation !== false);
    } catch {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al interpretar la respuesta de IA.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${orders.length} orders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        orders, 
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
