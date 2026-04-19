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

    const systemPrompt = `Eres un experto en logística de courier USA→Venezuela para Brillitos Store. Ana importa de AliExpress, Shein, Temu y Amazon.

REGLA CRÍTICA DE PESO: SIEMPRE usa el peso REAL del producto en sí (sin empaque pesado). NO infles. Si dudas, escoge el rango BAJO. Una libra de más son varios dólares de envío de más.

Pesos típicos REALISTAS por unidad (úsalos como referencia base):
- Ropa interior, medias, accesorios pequeños (aretes, anillos): 0.05-0.1 lb
- Camisetas, tops, blusas livianas: 0.2-0.3 lb
- Vestidos, jeans, suéteres: 0.4-0.6 lb
- Chaquetas, abrigos: 0.8-1.2 lb
- Zapatos planos/sandalias: 0.8-1.2 lb (par)
- Tenis/botas: 1.5-2 lb (par)
- Bolsos pequeños/clutch: 0.3-0.5 lb
- Bolsos medianos/carteras: 0.6-1 lb
- Electrónicos pequeños (cables, cargadores): 0.2-0.4 lb
- Maquillaje individual: 0.05-0.15 lb
- Sets de maquillaje: 0.3-0.6 lb
- Juguetes pequeños: 0.2-0.5 lb
- Libros: 0.5-1 lb

Si ves el peso explícito en la imagen, ÚSALO sin modificar.

Para CADA producto devuelve:
- nombre breve
- cantidad de unidades (si es set/pack)
- precio unitario en USD si se ve (sino null) — NUNCA inventes precios
- precio total del item (unitario × cantidad) si se puede inferir
- peso estimado en libras por unidad de ese item (no del set completo si son varios)

Luego suma el peso total = Σ(weight_lb × quantity) y devuelve también el subtotal de productos si se ve.
Sé conservador. Mejor subestimar peso que sobreestimarlo.`;

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

    // Recalculate total weight from items (weight per unit × quantity) — more reliable than IA's total
    const itemsTotalWeight = items.reduce((s: number, it: any) => {
      const w = Number(it.weight_lb) || 0;
      const q = Math.max(1, Number(it.quantity) || 1);
      return s + w * q;
    }, 0);
    const aiTotalWeight = Math.max(0.1, Number(args.estimated_weight_lb) || 0.5);
    // Use the smaller of the two — prevents AI from inflating
    const weightLb = itemsTotalWeight > 0 ? Math.min(itemsTotalWeight, aiTotalWeight) : aiTotalWeight;
    const billableLb = Math.ceil(weightLb);
    const myCost = billableLb * Number(ratePerLb);
    const charge = billableLb * Number(pricePerLb);

    // Per-item shipping allocation (proportional to weight × qty)
    const totalItemWeightForShare = items.reduce((s: number, it: any) => {
      const w = Number(it.weight_lb) || 0;
      const q = Math.max(1, Number(it.quantity) || 1);
      return s + w * q;
    }, 0) || weightLb;
    const enrichedItems = items.map((it: any) => {
      const w = Number(it.weight_lb) || 0;
      const qty = Math.max(1, Number(it.quantity) || 1);
      const itemTotalWeight = w * qty;
      const share = totalItemWeightForShare > 0 ? itemTotalWeight / totalItemWeightForShare : 0;
      const itemShipping = Math.round(charge * share * 100) / 100;
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
