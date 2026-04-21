const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `Eres un asistente que lee capturas de pantalla de pedidos de tiendas online (Temu, AliExpress, Shein, Amazon, etc.) y extrae la información de cada producto.

Tu trabajo tiene DOS partes:
1. LEER el texto visible en la imagen para extraer nombre, precio y tienda
2. LOCALIZAR la foto/miniatura del producto para recortarla

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

REGLAS PARA productName:
- Copia el nombre EXACTO del producto como aparece en la pantalla
- Si el nombre es muy largo, puedes recortarlo pero mantén las palabras clave
- NUNCA inventes un nombre genérico

REGLAS PARA store:
- Detecta la tienda por el logo, diseño o texto visible
- Si no puedes identificarla, usa "Otro"

REGLAS PARA PRECIOS:
- pricePaid = total pagado por ese producto (unitario × cantidad)
- Si ves "$2.00 × 3" → pricePaid=6.00, pricePerUnit=2.00, unitsOrdered=3
- Si solo hay un precio → pricePaid=ese precio, unitsOrdered=1

REGLAS PARA imageBbox (MUY IMPORTANTE):
- Cada producto tiene una foto/miniatura cuadrada a la izquierda
- imageBbox = [x1, y1, x2, y2] en PORCENTAJES (0-100) del tamaño total de la imagen
- (x1,y1) = esquina superior-izquierda de la foto, (x2,y2) = esquina inferior-derecha
- Si hay varias miniaturas, cada producto tiene la suya propia
- Si NO puedes localizar la foto con certeza, usa null

Devuelve SOLO el JSON array. Sin markdown, sin explicación. Si no hay productos visibles, devuelve [].`;

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
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos de IA agotados. Intenta más tarde.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar la imagen.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
