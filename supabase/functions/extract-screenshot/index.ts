const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `Eres un experto en leer capturas de pantalla de pedidos de tiendas online (Temu, AliExpress, Shein, Amazon).

Analiza la imagen y extrae CADA producto visible. Devuelve un JSON array.

Campos requeridos por producto:
{
  "productName": "nombre real del producto tal como aparece en la captura",
  "imageBbox": [x1, y1, x2, y2],
  "store": "Temu" | "AliExpress" | "Shein" | "Amazon",
  "pricePaid": 12.99,
  "orderNumber": "123456789",
  "orderDate": "2026-02-20",
  "estimatedArrival": "2026-03-15",
  "unitsOrdered": 1,
  "pricePerUnit": 12.99
}

REGLAS:
- productName DEBE ser el nombre real del artículo visible en la imagen. NUNCA escribas "Product", "Pedido" u otro texto genérico.
- imageBbox: coordenadas [x1, y1, x2, y2] en PORCENTAJE (0-100) de la miniatura/foto del producto dentro de la captura. x1,y1 es la esquina superior izquierda, x2,y2 la inferior derecha. Ejemplo: [2, 15, 25, 40] significa que la miniatura empieza en 2% desde la izquierda, 15% desde arriba, y termina en 25% ancho, 40% alto. Si no hay miniatura visible, usa null.
- Si no puedes leer un campo, usa null.
- Detecta la tienda por el diseño/logo visible (Temu naranja, AliExpress rojo, Shein negro, Amazon azul).
- Si hay varios productos en la imagen, crea una entrada por cada uno.
- pricePaid es el precio total pagado por ese producto.

Devuelve SOLO un JSON array válido. Sin markdown, sin explicación. Si no ves ningún pedido, devuelve [].`;

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

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se proporcionó imagen.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing screenshot with AI vision...');

    // Ensure proper data URL format
    const imageUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

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

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Demasiadas solicitudes. Espera un momento.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos agotados.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar la imagen.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let orders = [];
    try {
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      orders = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      console.log(`Extracted ${orders.length} orders:`, JSON.stringify(orders.map((o: any) => ({ name: o.productName?.slice(0, 40), price: o.pricePaid, store: o.store }))));
    } catch {
      console.error('Parse error:', content.slice(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo interpretar la respuesta del AI.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
