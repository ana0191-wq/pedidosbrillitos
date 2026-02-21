const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `You are an order data extractor analyzing email content. Extract order information and return a JSON array of orders found.

Each order object should have:
- productName: string
- store: "AliExpress" | "Shein" | "Temu" | "Amazon" | null
- pricePaid: number | null
- orderNumber: string | null
- orderDate: string | null (YYYY-MM-DD)
- estimatedArrival: string | null (YYYY-MM-DD)
- unitsOrdered: number | null
- pricePerUnit: number | null

Return ONLY valid JSON array. If no orders found, return [].
Detect store from sender email, subject, or content. Common senders:
- AliExpress: noreply@aliexpress.com, transaction@notice.aliexpress.com
- Shein: info@shein.com
- Temu: noreply@temu.com
- Amazon: auto-confirm@amazon.com, ship-confirm@amazon.com`;

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
  if (!res.ok) throw new Error('Failed to refresh token');
  return data.access_token;
}

async function getEmails(accessToken: string, maxResults = 20): Promise<any[]> {
  // Search for order-related emails from the last 30 days
  const query = encodeURIComponent(
    'from:(aliexpress OR shein OR temu OR amazon) subject:(order OR pedido OR shipped OR enviado OR confirmation OR confirmación) newer_than:30d'
  );

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const listData = await listRes.json();
  if (!listData.messages?.length) return [];

  // Fetch each message
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

function extractEmailContent(message: any): { subject: string; from: string; body: string } {
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
  const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';

  let body = '';

  function extractText(part: any): string {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    if (part.parts) {
      return part.parts.map(extractText).join('\n');
    }
    return '';
  }

  body = extractText(message.payload);
  // Limit body to prevent token overflow
  body = body.slice(0, 3000);

  return { subject, from, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessToken, refreshToken } = await req.json();

    let token = accessToken;

    // Try to use access token, refresh if needed
    const testRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!testRes.ok && refreshToken) {
      token = await refreshAccessToken(refreshToken);
    } else if (!testRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token expired, please reconnect Gmail' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch emails
    const emails = await getEmails(token);
    if (!emails.length) {
      return new Response(
        JSON.stringify({ success: true, orders: [], message: 'No order emails found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract content from emails
    const emailContents = emails.map(extractEmailContent);
    const emailSummary = emailContents
      .map((e, i) => `--- Email ${i + 1} ---\nFrom: ${e.from}\nSubject: ${e.subject}\n${e.body}`)
      .join('\n\n');

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
      console.error('AI error:', await aiResponse.text());
      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let orders = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      orders = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error('Failed to parse AI response:', content);
    }

    return new Response(
      JSON.stringify({ success: true, orders, newAccessToken: token !== accessToken ? token : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
