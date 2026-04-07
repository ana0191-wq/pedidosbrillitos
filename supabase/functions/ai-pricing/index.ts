const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key no configurada.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { type } = body;

    let requestBody: any;

    if (type === 'merchandise') {
      const { productName, costUSD, exchangeRate, profitPercent, extraCosts, imageBase64 } = body;

      const textPrompt = `Eres el asistente de precios de Brillitos Store, una tienda de reventa venezolana.
Responde SOLO con JSON válido, sin markdown ni explicaciones.

${imageBase64 ? 'Analiza la imagen del producto y lee el precio si es visible.' : ''}
${productName ? `Producto: ${productName}` : ''}
${costUSD ? `Costo en USD: $${costUSD}` : 'Lee el costo de la imagen si está disponible.'}
Tasa de cambio: ${exchangeRate} Bs/$
Porcentaje de ganancia deseado: ${profitPercent}%
Costos extra (envío, etc.): $${extraCosts || 0}

Calcula:
1. costUSD: costo real del producto en USD
2. salePriceUSD: precio de venta en USD (costo + extras + margen)
3. salePriceVES: precio de venta en Bs (salePriceUSD × tasa)
4. profitUSD: ganancia neta en USD
5. profitPercent: porcentaje de ganancia real
6. suggestion: recomendación breve en español (max 100 chars)

Formato exacto: {"costUSD":0,"salePriceUSD":0,"salePriceVES":0,"profitUSD":0,"profitPercent":0,"suggestion":"..."}`;

      const parts: any[] = [];

      if (imageBase64) {
        // Strip data URI prefix if present
        const base64Data = imageBase64.startsWith('data:')
          ? imageBase64.split(',')[1]
          : imageBase64;
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
      }

      parts.push({ text: textPrompt });

      requestBody = {
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.3,
        },
      };

    } else if (type === 'shipping') {
      const { weight, destination, shippingType, exchangeRate } = body;

      const textPrompt = `Eres el asistente de envíos de Brillitos Store, una tienda venezolana.
Responde SOLO con JSON válido, sin markdown ni explicaciones.

Peso: ${weight} kg
Destino: ${destination}
Tipo de envío: ${shippingType}
Tasa de cambio: ${exchangeRate} Bs/$

Estima:
1. shippingUSD: costo aproximado del envío en USD
2. shippingVES: costo en bolívares
3. estimatedDays: días estimados de entrega
4. suggestion: recomendación breve en español (max 100 chars)

Formato exacto: {"shippingUSD":0,"shippingVES":0,"estimatedDays":0,"suggestion":"..."}`;

      requestBody = {
        contents: [{ parts: [{ text: textPrompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.3,
        },
      };

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo no válido. Usa "merchandise" o "shipping".' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini error:', geminiResponse.status, errText);

      if (geminiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Demasiadas solicitudes. Espera un momento.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Error al procesar con IA.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let result = {};
    try {
      const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      console.error('Parse error:', content.slice(0, 300));
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo interpretar la respuesta.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: `Error: ${error.message}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
