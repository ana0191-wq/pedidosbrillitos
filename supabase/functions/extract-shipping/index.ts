const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

const EXTRACTION_PROMPT = `Eres un experto en leer etiquetas de courier, facturas de envío y texto sobre paquetes.

Analiza el input (imagen o texto) y extrae la siguiente información de envío:

{
  "weight_lb": number | null,
  "weight_oz": number | null,
  "length_in": number | null,
  "width_in": number | null,
  "height_in": number | null,
  "shipping_type": "AEREO" | "MARITIMO" | null,
  "shipping_cost": number | null,
  "carrier": string | null,
  "tracking_number": string | null
}

REGLAS:
- Si el peso está en kg, conviértelo: 1 kg = 2.20462 lb
- Si las dimensiones están en cm, conviértelas: 1 cm = 0.393701 in
- Si detectas "by sea" o "marítimo", shipping_type = "MARITIMO"
- Si detectas "by air" o "aéreo", shipping_type = "AEREO"
- Extrae el tracking number si es visible
- Devuelve SOLO JSON válido, sin markdown ni explicaciones
- Si no puedes leer un campo, usa null`;

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

    const { imageBase64, text } = await req.json();

    if (!imageBase64 && !text) {
      return new Response(
        JSON.stringify({ success: false, error: 'Proporciona imagen o texto.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages: any[] = [{ role: 'system', content: EXTRACTION_PROMPT }];

    if (imageBase64) {
      const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Extrae los datos de envío de esta imagen:' },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: `Extrae los datos de envío de este texto:\n\n${text}` });
    }

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages, temperature: 0.1 }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) return new Response(JSON.stringify({ success: false, error: 'Demasiadas solicitudes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (status === 402) return new Response(JSON.stringify({ success: false, error: 'Créditos agotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: false, error: 'Error al procesar.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let result = {};
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo interpretar la respuesta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: `Error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
