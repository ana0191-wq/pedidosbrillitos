const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `Eres un experto en leer capturas de pantalla de pedidos de tiendas online (Temu, AliExpress, Shein, Amazon).

Analiza la imagen y extrae CADA producto visible. Devuelve un JSON array.

IMPORTANTE: Cada producto en las apps de compras tiene una MINIATURA/FOTO a la izquierda. DEBES indicar dónde está esa foto.

Campos requeridos por producto:
{
  "productName": "nombre real del producto",
  "imageBbox": [x1_percent, y1_percent, x2_percent, y2_percent],
  "store": "Temu" | "AliExpress" | "Shein" | "Amazon",
  "pricePaid": 12.99,
  "orderNumber": "123456789",
  "orderDate": "2026-02-20",
  "estimatedArrival": "2026-03-15",
  "unitsOrdered": 1,
  "pricePerUnit": 12.99
}

REGLAS CRÍTICAS PARA imageBbox:
- imageBbox es OBLIGATORIO para cada producto. Es un array de 4 números.
- Los valores son PORCENTAJES (0-100) relativos al tamaño total de la imagen.
- [x1, y1, x2, y2] donde (x1,y1) = esquina superior-izquierda y (x2,y2) = esquina inferior-derecha de la FOTO/MINIATURA del producto.
- Ejemplo: si la miniatura del producto está en la esquina superior izquierda ocupando ~20% del ancho y entre 10%-30% del alto: [0, 10, 20, 30]
- NUNCA pongas null en imageBbox. Siempre hay una miniatura visible junto a cada producto.

OTRAS REGLAS:
- productName DEBE ser el nombre real del artículo. NUNCA escribas texto genérico.
- Si no puedes leer un campo (excepto imageBbox), usa null.
- Detecta la tienda por el diseño/logo visible.
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
      console.log(`Extracted ${orders.length} orders:`, JSON.stringify(orders.map((o: any) => ({ name: o.productName?.slice(0, 30), bbox: o.imageBbox, price: o.pricePaid }))));
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
