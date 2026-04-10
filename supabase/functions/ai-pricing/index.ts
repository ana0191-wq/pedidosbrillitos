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

${imageBase64 ? 'Analiza la imagen del producto y lee el precio y nombre si son visibles.' : ''}
${productName ? `Producto: ${productName}` : ''}
${costUSD ? `Costo en USD: $${costUSD}` : 'Lee el costo de la imagen si está disponible.'}
Tasa de cambio: ${exchangeRate} Bs/$
Porcentaje de ganancia deseado: ${profitPercent}%
Costos extra (envío, etc.): $${extraCosts || 0}

IMPORTANTE: Detecta si el producto es un set o paquete. Busca palabras como "set of", "pack of", "pcs", "unidades", "x2", "x3", "2 pcs", "3 pack", "set de 2", etc.
Si es un set, calcula también el precio por unidad.

Calcula:
1. productName: nombre del producto detectado
2. isSet: true si es un set/pack/bundle, false si es unidad individual
3. setQuantity: cantidad de unidades en el set (1 si no es set)
4. costUSD: costo total del producto en USD
5. costPerUnitUSD: costo por unidad (costUSD / setQuantity)
6. salePriceUSD: precio de venta total en USD (costo + extras + margen)
7. salePriceVES: precio de venta total en Bs
8. salePricePerUnitUSD: precio de venta por unidad en USD
9. salePricePerUnitVES: precio de venta por unidad en Bs
10. profitUSD: ganancia neta total en USD
11. profitPercent: porcentaje de ganancia real
12. suggestion: recomendación breve en español (max 100 chars)

Formato exacto:
{"productName":"...","isSet":false,"setQuantity":1,"costUSD":0,"costPerUnitUSD":0,"salePriceUSD":0,"salePriceVES":0,"salePricePerUnitUSD":0,"salePricePerUnitVES":0,"profitUSD":0,"profitPercent":0,"suggestion":"..."}`;

      const parts: any[] = [];

      if (imageBase64) {
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

    } else if (type === 'shipping-estimate') {
      const { imageBase64, clientRate } = body;
      const rate = clientRate || 12;

      const textPrompt = `Look at this product image. Identify what it is. Give a realistic estimated weight range in lbs for ONE unit of this type of product. Then calculate tentative shipping costs for quantities: 1, 5, 10, 20 units using $${rate}/lb rate.
Respond ONLY with valid JSON, no markdown or explanations.
Format: {"product_type":"...","weight_min_lbs":0.3,"weight_max_lbs":0.6,"estimates":[{"qty":1,"total_shipping":7.2,"per_unit_shipping":7.2},{"qty":5,"total_shipping":36,"per_unit_shipping":7.2},{"qty":10,"total_shipping":72,"per_unit_shipping":7.2},{"qty":20,"total_shipping":144,"per_unit_shipping":7.2}]}`;

      const parts: any[] = [];
      if (imageBase64) {
        const base64Data = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;
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

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo no válido. Usa "merchandise", "shipping" o "shipping-estimate".' }),
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
