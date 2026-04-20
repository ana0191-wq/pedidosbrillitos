const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function detectStore(url: string): string {
  if (url.includes('shein')) return 'Shein';
  if (url.includes('temu')) return 'Temu';
  if (url.includes('amazon')) return 'Amazon';
  if (url.includes('aliexpress')) return 'AliExpress';
  return 'Otro';
}

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const og = extractMeta(html, 'og:title');
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() || null;
}

function extractPrice(html: string, store: string): number | null {
  const ldMatch = html.match(/"price"\s*:\s*"?([\d.]+)"?/);
  if (ldMatch) return parseFloat(ldMatch[1]);
  const metaPrice = extractMeta(html, 'product:price:amount');
  if (metaPrice) return parseFloat(metaPrice);
  const genericPrice = html.match(/[\$]([\d]+\.[\d]{2})/);
  if (genericPrice) return parseFloat(genericPrice[1]);
  return null;
}

async function fetchProductImage(imageUrl: string): Promise<string | null> {
  try {
    const r = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const ct = r.headers.get('content-type') || 'image/jpeg';
    return `data:${ct};base64,${b64}`;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ success: false, error: 'No URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const store = detectStore(url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
        'Accept-Language': 'es-419,es;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    const html = await res.text();

    const name = extractTitle(html);
    const price = extractPrice(html, store);
    const imageUrl = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description');

    let imageBase64: string | null = null;
    if (imageUrl) imageBase64 = await fetchProductImage(imageUrl);

    return new Response(JSON.stringify({ success: true, store, name: name || null, price: price || null, imageBase64, imageUrl, description }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
