const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try pydolarve API for BCV rate
    const response = await fetch('https://pydolarve.org/api/v2/dollar?monitor=bcv');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    // pydolarve returns { price, last_update, ... }
    const rate = data?.price || data?.monitors?.bcv?.price;
    
    if (!rate) {
      throw new Error('No se pudo obtener la tasa');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        rate: Number(rate),
        source: 'BCV',
        updated: data?.last_update || data?.monitors?.bcv?.last_update || new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Exchange rate error:', error);
    return new Response(
      JSON.stringify({ success: false, error: `No se pudo obtener la tasa: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
