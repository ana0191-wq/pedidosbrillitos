const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const IMAGE_PROMPT = `Eres un asistente que lee capturas de pantalla de pedidos de tiendas online (Temu, AliExpress, Shein, Amazon, etc.) y extrae la información de cada producto.

Devuelve un JSON array con UN objeto por producto:
{
  "productName": "nombre completo del producto tal como aparece en la imagen",
  "store": "Temu" | "Shein" | "AliExpress" | "Amazon" | "Otro",
  "pricePaid": 12.99,
  "pricePerUnit": 12.99,
  "unitsOrdered": 1,
  "orderNumber": "123456789" | null,
  "imageBbox": [x1, y1, x2, y2]
}

REGLAS:
- productName: copia el nombre EXACTO. NUNCA inventes un nombre genérico.
- store: detecta por logo, diseño o texto visible. Si no puedes, usa "Otro".
- pricePaid = total pagado (unitario × cantidad)
- imageBbox = coordenadas [x1,y1,x2,y2] en % (0-100) de la miniatura del producto. null si no la ves.

Devuelve SOLO el JSON array. Sin markdown. Si no hay productos, devuelve [].`;

const TEXT_PROMPT = `Eres un extractor de pedidos de tiendas online. Se te dará texto extraído de una página HTML de órdenes (SHEIN, Temu, AliExpress, Amazon, etc.).

Extrae CADA producto y devuelve un JSON array:
{
  "productName": "nombre exacto del producto",
  "store": "SHEIN" | "Temu" | "AliExpress" | "Amazon" | "Otro",
  "pricePaid": 12.99,
  "unitsOrdered": 1,
  "orderNumber": "123456" | null,
  "orderDate": "2026-01-15" | null,
  "estimatedArrival": "2026-02-01" | null,
  "productImageUrl": "https://..." | null
}

REGLAS:
- productName DEBE ser el nombre real. NUNCA escribas "Producto", "Item" o genéricos.
- Si hay múltiples productos, extrae TODOS.
- pricePaid = precio final pagado por unidad × cantidad.
- Devuelve SOLO el JSON array. Sin markdown. Si no hay productos, devuelve [].`;

// Strip HTML to clean readable text
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|td|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()
    .slice(0, 28000);
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

    const body = await req.json();
    const { imageBase64, rawText, htmlContent } = body;

    // ── TEXT mode (HTML page) ─────────────────────────────────────────────
    if (rawText || htmlContent) {
      const inputText = rawText ?? htmlToText(htmlContent);
      console.log('Processing text/HTML, length:', inputText.length);

      const aiResponse = await fetch(AI_GATEWAY, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'system', content: TEXT_PROMPT },
            { role: 'user', content: `Extrae todos los productos de este contenido:\n\n${inputText}` },
          ],
          temperature: 0.1,
        }),
      });

      if (!aiResponse.ok) {
        const err = await aiResponse.text();
        console.error('AI text error:', err);
        return new Response(
          JSON.stringify({ success: false, error: 'Error al procesar el texto.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';

      let orders = [];
      try {
        const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = cleaned.match(/\[[\s\S]*\]/);
        orders = match ? JSON.parse(match[0]) : [];
        console.log(`Text extracted ${orders.length} products`);
      } catch {
        console.error('Parse error:', content.slice(0, 300));
        return new Response(
          JSON.stringify({ success: false, error: 'No se pudo interpretar la respuesta.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, orders }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── IMAGE mode (screenshot) ───────────────────────────────────────────
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se proporcionó imagen o texto.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing screenshot with AI vision...');
    const imageUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: IMAGE_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrae todos los pedidos de esta captura de pantalla:' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', errText);
      if (aiResponse.status === 429) return new Response(JSON.stringify({ success: false, error: 'Demasiadas solicitudes. Espera un momento.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ success: false, error: 'Créditos de IA agotados.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: false, error: 'Error al procesar la imagen.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let orders = [];
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      orders = match ? JSON.parse(match[0]) : [];
      console.log(`Image extracted ${orders.length} orders`);
    } catch {
      console.error('Parse error:', content.slice(0, 300));
      return new Response(JSON.stringify({ success: false, error: 'No se pudo interpretar la respuesta del AI.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, orders }),
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
