const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchFromPyDolarVe(): Promise<{ rate: number; updated: string }> {
  const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
  if (!res.ok) throw new Error(`dolarapi status ${res.status}`);
  const data = await res.json();
  // { fuente: "oficial", nombre: "Oficial", compra: XX.XX, venta: XX.XX, promedio: XX.XX, fechaActualizacion: "..." }
  const rate = data?.promedio || data?.venta;
  if (!rate || rate <= 0) throw new Error('No rate from dolarapi');
  return { rate: Number(rate), updated: data?.fechaActualizacion || new Date().toISOString() };
}

async function fetchFromAlternative(): Promise<{ rate: number; updated: string }> {
  // Fallback: use open.er-api.com (free, no key needed)
  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) throw new Error(`er-api status ${res.status}`);
  const data = await res.json();
  const vesRate = data?.rates?.VES;
  if (!vesRate || vesRate <= 0) throw new Error('No VES rate');
  return { rate: Number(vesRate), updated: data?.time_last_update_utc || new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let result: { rate: number; updated: string };
    let source = 'BCV';

    try {
      result = await fetchFromPyDolarVe();
    } catch (e1) {
      console.warn('Primary API failed:', e1.message);
      try {
        result = await fetchFromAlternative();
        source = 'Open ER API';
      } catch (e2) {
        throw new Error(`Todas las fuentes fallaron: ${e1.message} | ${e2.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, rate: result.rate, source, updated: result.updated }),
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
