// Edge function: estimate shipping weight/volume from product description or screenshot using Lovable AI
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { description = '', ratePerLb = 6.5, pricePerLb = 12, imageBase64 = null, exchangeRate = null } = await req.json();
    if (!description.trim() && !imageBase64) {
      return new Response(JSON.stringify({ success: false, error: 'Se requiere descripción o imagen' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurada');

    const systemPrompt = `Eres un experto en logística de courier desde USA hacia Venezuela para Brillitos Store. Ana importa productos de AliExpress, Shein, Temu y Amazon.

Tu trabajo: dada una descripción de productos Y/O una captura de carrito/factura, identifica CADA producto individual con:
- nombre breve
- cantidad de unidades (si es set/pack)
- precio unitario en USD si se ve en la imagen (sino null)
- precio total del item (precio_unitario × cantidad) si se puede inferir
- peso estimado en libras por item (considera empaque): ropa liviana 0.3-0.5, zapatos 1.5-2, electrónicos pequeños 0.5, accesorios pequeños 0.1-0.2, bolsos 0.8-1.5

Luego calcula el peso TOTAL sumando todos los items y devuelve también el subtotal de productos si se ve.
Sé realista y conservador.`;

    const userParts: any[] = [];
    if (imageBase64) {
      const base64Data = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;
      userParts.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64Data}` },
      });
    }
    const textPart = description.trim()
      ? `Productos: ${description}${imageBase64 ? '. Combínalo con lo que ves en la imagen.' : ''}`
      : 'Analiza la captura y extrae todos los productos visibles con sus precios.';
    userParts.push({ type: 'text', text: textPart });

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
          { role: 'user', content: userParts },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'estimate_shipping',
            description: 'Devuelve items detectados, peso total y subtotal',
            parameters: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  description: 'Lista de productos detectados',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      quantity: { type: 'number' },
                      unit_price_usd: { type: ['number', 'null'] },
                      total_price_usd: { type: ['number', 'null'] },
                      weight_lb: { type: 'number' },
                    },
                    required: ['name', 'quantity', 'unit_price_usd', 'total_price_usd', 'weight_lb'],
                    additionalProperties: false,
                  },
                },
                estimated_weight_lb: { type: 'number', description: 'Peso total en libras' },
                products_subtotal_usd: { type: ['number', 'null'], description: 'Subtotal de productos visibles, null si no aplica' },
                reasoning: { type: 'string' },
                confidence: { type: 'string', enum: ['baja', 'media', 'alta'] },
              },
              required: ['items', 'estimated_weight_lb', 'products_subtotal_usd', 'reasoning', 'confidence'],
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
    const items = Array.isArray(args.items) ? args.items : [];

    const weightLb = Math.max(0.1, Number(args.estimated_weight_lb) || 0.5);
    const billableLb = Math.ceil(weightLb);
    const myCost = billableLb * Number(ratePerLb);
    const charge = billableLb * Number(pricePerLb);

    // Per-item shipping allocation (proportional to weight)
    const totalItemWeight = items.reduce((s: number, it: any) => s + (Number(it.weight_lb) || 0), 0) || weightLb;
    const enrichedItems = items.map((it: any) => {
      const w = Number(it.weight_lb) || 0;
      const share = totalItemWeight > 0 ? w / totalItemWeight : 0;
      const itemShipping = Math.round(charge * share * 100) / 100;
      const qty = Math.max(1, Number(it.quantity) || 1);
      const totalPrice = it.total_price_usd != null ? Number(it.total_price_usd) : (it.unit_price_usd != null ? Number(it.unit_price_usd) * qty : null);
      const unitPrice = it.unit_price_usd != null ? Number(it.unit_price_usd) : (totalPrice != null ? totalPrice / qty : null);
      const fullTotal = totalPrice != null ? totalPrice + itemShipping : null;
      const fullPerUnit = fullTotal != null ? fullTotal / qty : null;
      return {
        name: it.name,
        quantity: qty,
        weight_lb: Math.round(w * 100) / 100,
        unit_price_usd: unitPrice != null ? Math.round(unitPrice * 100) / 100 : null,
        total_price_usd: totalPrice != null ? Math.round(totalPrice * 100) / 100 : null,
        shipping_share_usd: itemShipping,
        full_total_usd: fullTotal != null ? Math.round(fullTotal * 100) / 100 : null,
        full_per_unit_usd: fullPerUnit != null ? Math.round(fullPerUnit * 100) / 100 : null,
      };
    });

    const productsSubtotal = args.products_subtotal_usd != null
      ? Number(args.products_subtotal_usd)
      : enrichedItems.reduce((s: number, it: any) => s + (it.total_price_usd || 0), 0);

    return new Response(JSON.stringify({
      success: true,
      data: {
        items: enrichedItems,
        estimated_weight_lb: Math.round(weightLb * 100) / 100,
        billable_weight_lb: billableLb,
        reasoning: args.reasoning,
        confidence: args.confidence,
        my_cost: Math.round(myCost * 100) / 100,
        client_charge: Math.round(charge * 100) / 100,
        profit: Math.round((charge - myCost) * 100) / 100,
        products_subtotal_usd: productsSubtotal ? Math.round(productsSubtotal * 100) / 100 : null,
        grand_total_usd: productsSubtotal ? Math.round((productsSubtotal + charge) * 100) / 100 : null,
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
