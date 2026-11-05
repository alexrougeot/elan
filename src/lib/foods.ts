// Recherche d'aliments : table Ciqual (hors ligne) et Open Food Facts (en ligne).
import type { Macros } from './nutrition';
import { allOf, getDoc, putDoc, removeDoc } from './store';

export type FoodItem = {
  name: string;
  brand?: string;
  group?: string;
  per100: Macros;
  src: 'ciqual' | 'off' | 'perso';
  ref: string;
  image?: string;
  serving?: number;
  /** aliment perso décrit à l'unité : « 1 œuf = 100 g » */
  unit?: { one: string; many: string; grams: number };
};

type CiqualRow = [number, string, string, number, number, number, number];
let ciqual: { item: FoodItem; norm: string }[] | null = null;
let loading: Promise<void> | null = null;

export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loadCiqual() {
  if (ciqual) return Promise.resolve();
  if (!loading) {
    loading = fetch(import.meta.env.BASE_URL + 'data/aliments.json')
      .then((r) => r.json())
      .then((j: { aliments: CiqualRow[] }) => {
        ciqual = j.aliments.map(([code, nom, groupe, k, p, g, l]) => ({
          item: { name: nom, group: groupe, per100: { k, p, g, l }, src: 'ciqual', ref: 'ciqual:' + code },
          norm: norm(nom),
        }));
      })
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

export function searchCiqual(q: string, limit = 40): FoodItem[] {
  if (!ciqual) return [];
  const words = norm(q).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const scored: { item: FoodItem; s: number }[] = [];
  for (const c of ciqual) {
    let s = 0;
    let ok = true;
    for (const w of words) {
      const i = c.norm.indexOf(w);
      if (i < 0) {
        ok = false;
        break;
      }
      s += i === 0 ? 0 : c.norm[i - 1] === ' ' ? 2 : 6;
    }
    if (!ok) continue;
    s += c.norm.length / 25;
    if (/\b(cru|cuit|nature)\b/.test(c.norm)) s -= 0.5;
    scored.push({ item: c.item, s });
  }
  return scored
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((x) => x.item);
}

// ---- Open Food Facts ----
const OFF = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_quantity,image_front_small_url';

function text(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text(v.fr ?? v.main ?? v.en ?? Object.values(v)[0]);
  return String(v);
}

function fromOff(p: any): FoodItem | null {
  const n = p?.nutriments ?? {};
  let k = n['energy-kcal_100g'];
  if (k === undefined && n['energy_100g'] !== undefined) k = n['energy_100g'] / 4.184;
  const name = (text(p.product_name_fr) || text(p.product_name) || text(p.generic_name_fr)).trim();
  if (!name || k === undefined || p.code === undefined) return null;
  const brand = text(p.brands).split(',')[0]?.trim();
  return {
    name,
    brand: brand || undefined,
    per100: {
      k: Math.round(Number(k) || 0),
      p: Number(n.proteins_100g) || 0,
      g: Number(n.carbohydrates_100g) || 0,
      l: Number(n.fat_100g) || 0,
    },
    src: 'off',
    ref: 'off:' + p.code,
    image: text(p.image_front_small_url) || undefined,
    serving: Number(p.serving_quantity) || undefined,
  };
}

async function fetchJson(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (r.status === 404) return { status: 404 } as any;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const PROXY = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1/off';

export async function offProduct(code: string): Promise<FoodItem | null | 'incomplete'> {
  let j: any;
  try {
    j = await fetchJson(`${PROXY}?code=${encodeURIComponent(code)}`, 10000);
  } catch {
    j = await fetchJson(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  }
  if (j.status === 404 || j.status !== 1 || !j.product) return null;
  return fromOff({ ...j.product, code }) ?? 'incomplete';
}

/** Recherche texte : nouveau moteur d'Open Food Facts, puis l'ancien si besoin */
export async function offSearch(q: string): Promise<FoodItem[]> {
  const seen = new Set<string>();
  const keep = (list: (FoodItem | null)[]) =>
    list.filter((x): x is FoodItem => {
      if (!x || seen.has(x.ref)) return false;
      seen.add(x.ref);
      return true;
    });
  try {
    // Relais Élan (le plus fiable depuis l'iPhone)
    const j = await fetchJson(`${PROXY}?q=${encodeURIComponent(q)}`, 12000);
    return keep((j.products ?? []).map(fromOff));
  } catch {
    /* appel direct en secours */
  }
  try {
    const j = await fetchJson(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=fr&page_size=24&fields=${FIELDS}`, 7000);
    const hits = keep((j.hits ?? []).map(fromOff));
    if (hits.length > 0) return hits;
  } catch {
    /* on essaie l'ancien moteur */
  }
  const j = await fetchJson(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&lc=fr&cc=fr&fields=${FIELDS}`, 9000);
  return keep((j.products ?? []).map(fromOff));
}

// ---- Mes aliments (scannés, créés, déjà utilisés) ----
export type MyFood = FoodItem & {
  lastGrams?: number;
  lastPortion?: { one: string; count: number };
  usedAt?: string;
  count?: number;
  /** poids d'unité personnalisés : { banane: 130 } */
  units?: Record<string, number>;
};

export function myFoods() {
  return allOf<MyFood>('myfood')
    .map((d) => d.data)
    .sort((a, b) => ((a.usedAt ?? '') < (b.usedAt ?? '') ? 1 : -1));
}

export async function rememberFood(item: FoodItem, grams?: number, portion?: { one: string; count: number }) {
  const id = 'myfood:' + item.ref;
  const prev = getDoc<MyFood>(id)?.data;
  await putDoc<MyFood>(id, 'myfood', {
    ...prev,
    ...item,
    lastGrams: grams ?? prev?.lastGrams,
    lastPortion: grams ? portion : prev?.lastPortion,
    usedAt: new Date().toISOString(),
    count: (prev?.count ?? 0) + (grams ? 1 : 0),
  });
}

/** Change le poids d'une unité pour cet aliment (« chez moi, 1 banane = 130 g ») */
export async function setUnitWeight(item: FoodItem, one: string, grams: number) {
  const id = 'myfood:' + item.ref;
  const prev = getDoc<MyFood>(id)?.data;
  await putDoc<MyFood>(id, 'myfood', { ...item, ...prev, units: { ...(prev?.units ?? {}), [one]: grams }, usedAt: prev?.usedAt ?? new Date().toISOString() });
}

export function isMine(ref: string) {
  return !!getDoc('myfood:' + ref);
}

export async function forgetFood(ref: string) {
  const id = 'myfood:' + ref;
  const prev = getDoc<MyFood>(id)?.data;
  await removeDoc(id);
  return prev;
}

export function searchMine(q: string) {
  const words = norm(q).split(' ').filter(Boolean);
  return myFoods().filter((f) => {
    const n = norm(f.name + ' ' + (f.brand ?? ''));
    return words.every((w) => n.includes(w));
  });
}
