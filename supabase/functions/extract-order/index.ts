const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `You are an order data extractor. Extract the following fields from the provided content. Return ONLY valid JSON, no markdown.

Fields to extract:
- productName: string (product name)
- store: "AliExpress" | "Shein" | "Temu" | "Amazon" | null
- pricePaid: number | null (total price paid)
- orderNumber: string | null
- orderDate: string | null (YYYY-MM-DD format)
- estimatedArrival: string | null (YYYY-MM-DD format)
- unitsOrdered: number | null
- pricePerUnit: number | null
- clientName: string | null
- shippingCost: number | null

If a field cannot be determined, set it to null. Be smart about detecting the store from URLs, logos, or text mentions.`;

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

    const { url, receiptImage } = await req.json();

    const messages: any[] = [
      { role: 'system', content: EXTRACTION_PROMPT }
    ];

    if (receiptImage) {
      // Receipt image (base64)
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Extract order information from this receipt/screenshot:' },
          { type: 'image_url', image_url: { url: receiptImage } }
        ]
      });
    } else if (url) {
      // Try to fetch the URL content first
      let pageContent = '';
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          redirect: 'follow',
        });
        const html = await res.text();
        // Extract meaningful text, limit to ~4000 chars
        const textOnly = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000);
        pageContent = textOnly;
      } catch (e) {
        console.error('Failed to fetch URL:', e);
      }

      // Detect store from URL
      let detectedStore = null;
      if (url.includes('aliexpress')) detectedStore = 'AliExpress';
      else if (url.includes('shein')) detectedStore = 'Shein';
      else if (url.includes('temu')) detectedStore = 'Temu';
      else if (url.includes('amazon')) detectedStore = 'Amazon';

      messages.push({
        role: 'user',
        content: `Extract order/product information from this URL: ${url}\n\nDetected store: ${detectedStore || 'unknown'}\n\nPage content:\n${pageContent || '(could not fetch page content, extract what you can from the URL itself)'}`
      });
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Provide url or receiptImage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    let extracted;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      console.error('Failed to parse AI response:', content);
      extracted = null;
    }

    if (!extracted) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract data' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: extracted }),
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
