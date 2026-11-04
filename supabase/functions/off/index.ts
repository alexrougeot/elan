// Relais vers Open Food Facts : recherche de produits et lecture d'un code-barres.
// Évite les soucis de navigateur (CORS) et s'identifie auprès d'Open Food Facts.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const UA = { 'User-Agent': 'Elan/1.0 (https://alexrougeot.github.io/elan/)', Accept: 'application/json' };
const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_quantity,image_front_small_url';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json; charset=utf-8' };
const json = (body: unknown, status = 200, cache = 'public, max-age=3600') => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Cache-Control': cache } });

async function get(url: string, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    return { status: r.status, body: r.ok || r.status === 404 ? await r.json().catch(() => null) : null };
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  const u = new URL(req.url);
  const code = (u.searchParams.get('code') ?? '').replace(/\D/g, '');
  const q = (u.searchParams.get('q') ?? '').trim().slice(0, 80);
  try {
    if (code) {
      const r = await get(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, 9000);
      if (r.status === 404) return json({ status: 0 }, 200);
      if (!r.body) return json({ error: 'indisponible' }, 502, 'no-store');
      return json(r.body);
    }
    if (q.length >= 2) {
      try {
        const r = await get(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=fr&page_size=24&fields=${FIELDS}`, 6000);
        const hits = (r.body as { hits?: unknown[] } | null)?.hits;
        if (hits && hits.length > 0) return json({ products: hits });
      } catch {
        /* on passe à l'ancien moteur */
      }
      const r = await get(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&lc=fr&cc=fr&fields=${FIELDS}`,
        10000
      );
      if (!r.body) return json({ error: 'indisponible' }, 502, 'no-store');
      return json({ products: (r.body as { products?: unknown[] }).products ?? [] });
    }
    return json({ error: 'paramètre manquant' }, 400, 'no-store');
  } catch (e) {
    console.error(e);
    return json({ error: 'indisponible' }, 502, 'no-store');
  }
});
