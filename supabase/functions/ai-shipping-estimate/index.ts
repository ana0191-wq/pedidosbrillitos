// Edge function: estimate shipping weight/volume from product description using Lovable AI
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { description, ratePerLb = 6.5, pricePerLb = 12 } = await req.json();
    if (!description || typeof description !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'description requerida' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurada');

    const systemPrompt = `Eres un experto en logística de courier desde USA hacia Venezuela. Ana importa productos de AliExpress, Shein, Temu y Amazon. Dado una descripción de productos, estima el peso TOTAL en libras (lbs) considerando empaque y volumen. Sé realista y conservador: ropa liviana ~0.3-0.5 lb, zapatos ~1.5-2 lb, electrónicos pequeños ~0.5 lb, accesorios pequeños ~0.1-0.2 lb. Devuelve el peso total estimado y un breve razonamiento.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Estima el peso total de estos productos: ${description}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'estimate_shipping',
            description: 'Devuelve el peso total estimado en libras',
            parameters: {
              type: 'object',
              properties: {
                estimated_weight_lb: { type: 'number', description: 'Peso total estimado en libras' },
                reasoning: { type: 'string', description: 'Breve explicación del estimado' },
                confidence: { type: 'string', enum: ['baja', 'media', 'alta'] },
              },
              required: ['estimated_weight_lb', 'reasoning', 'confidence'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'estimate_shipping' } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'Demasiadas peticiones, intenta de nuevo en un momento' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: 'Sin créditos de IA. Recarga en Settings > Workspace > Usage' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: false, error: 'Error de IA' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ success: false, error: 'IA no devolvió un estimado válido' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    const weightLb = Math.max(0.1, Number(args.estimated_weight_lb) || 0.5);
    const billableLb = Math.ceil(weightLb);
    const myCost = billableLb * Number(ratePerLb);
    const charge = billableLb * Number(pricePerLb);

    return new Response(JSON.stringify({
      success: true,
      data: {
        estimated_weight_lb: Math.round(weightLb * 100) / 100,
        billable_weight_lb: billableLb,
        reasoning: args.reasoning,
        confidence: args.confidence,
        my_cost: Math.round(myCost * 100) / 100,
        client_charge: Math.round(charge * 100) / 100,
        profit: Math.round((charge - myCost) * 100) / 100,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-shipping-estimate error:', e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Error desconocido' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
