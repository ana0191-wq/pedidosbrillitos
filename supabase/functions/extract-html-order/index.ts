const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const PROMPT = `Eres un extractor de pedidos de tiendas online. Se te dará el contenido HTML/texto de una página de órdenes de SHEIN, Temu, AliExpress, Amazon u otra tienda.

Tu tarea: extraer CADA producto del pedido y devolver un JSON array.

Por cada producto devuelve:
{
  "productName": "nombre exacto del producto",
  "store": "SHEIN" | "Temu" | "AliExpress" | "Amazon" | "Otro",
  "pricePaid": 12.99,
  "unitsOrdered": 1,
  "orderNumber": "123456" | null,
  "orderDate": "2026-01-15" | null,
  "estimatedArrival": "2026-02-01" | null,
  "productImageUrl": "https://..." | null,
  "sku": "SKU123" | null
}

REGLAS:
- productName DEBE ser el nombre real del artículo. NUNCA escribas genéricos como "Product" o "Item".
- Si hay múltiples productos en la página, extrae TODOS.
- pricePaid = precio unitario × cantidad si hay descuento, usa el precio final pagado.
- Si no puedes determinar un campo, usa null.
- Devuelve SOLO el JSON array. Sin markdown, sin explicación.
- Si no hay productos, devuelve [].`;

// Strip heavy HTML tags but keep text content
function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 30000); // keep within token limits
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

    const { htmlContent } = await req.json();
    if (!htmlContent) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se proporcionó contenido HTML.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanedText = cleanHtml(htmlContent);
    console.log('Cleaned HTML length:', cleanedText.length);

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: `Extrae todos los productos de este contenido de página de orden:\n\n${cleanedText}` },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar con IA.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let products = [];
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      products = match ? JSON.parse(match[0]) : [];
      console.log(`Extracted ${products.length} products`);
    } catch {
      console.error('Parse error:', content.slice(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo interpretar la respuesta del AI.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, products }),
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
