// Recherche d'aliments : table Ciqual (hors ligne) et Open Food Facts (en ligne).
import type { Macros } from './nutrition';
import { allOf, getDoc, putDoc } from './store';

export type FoodItem = {
  name: string;
  brand?: string;
  group?: string;
  per100: Macros;
  src: 'ciqual' | 'off' | 'perso';
  ref: string;
  image?: string;
  serving?: number;
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

function fromOff(p: any): FoodItem | null {
  const n = p?.nutriments ?? {};
  let k = n['energy-kcal_100g'];
  if (k === undefined && n['energy_100g'] !== undefined) k = n['energy_100g'] / 4.184;
  const name = (p.product_name_fr || p.product_name || p.generic_name_fr || '').trim();
  if (!name || k === undefined) return null;
  return {
    name,
    brand: (p.brands || '').split(',')[0]?.trim() || undefined,
    per100: {
      k: Math.round(Number(k) || 0),
      p: Number(n.proteins_100g) || 0,
      g: Number(n.carbohydrates_100g) || 0,
      l: Number(n.fat_100g) || 0,
    },
    src: 'off',
    ref: 'off:' + p.code,
    image: p.image_front_small_url,
    serving: Number(p.serving_quantity) || undefined,
  };
}

export async function offProduct(code: string): Promise<FoodItem | null | 'incomplete'> {
  const r = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (r.status === 404) return null;
  const j = await r.json();
  if (j.status !== 1 || !j.product) return null;
  return fromOff({ ...j.product, code }) ?? 'incomplete';
}

export async function offSearch(q: string): Promise<FoodItem[]> {
  const url = `${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&lc=fr&cc=fr&fields=${FIELDS}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.products ?? []).map(fromOff).filter(Boolean) as FoodItem[];
}

// ---- Mes aliments (scannés, créés, déjà utilisés) ----
export type MyFood = FoodItem & { lastGrams?: number; usedAt?: string; count?: number };

export function myFoods() {
  return allOf<MyFood>('myfood')
    .map((d) => d.data)
    .sort((a, b) => ((a.usedAt ?? '') < (b.usedAt ?? '') ? 1 : -1));
}

export async function rememberFood(item: FoodItem, grams?: number) {
  const id = 'myfood:' + item.ref;
  const prev = getDoc<MyFood>(id)?.data;
  await putDoc<MyFood>(id, 'myfood', {
    ...prev,
    ...item,
    lastGrams: grams ?? prev?.lastGrams,
    usedAt: new Date().toISOString(),
    count: (prev?.count ?? 0) + (grams ? 1 : 0),
  });
}

export function searchMine(q: string) {
  const words = norm(q).split(' ').filter(Boolean);
  return myFoods().filter((f) => {
    const n = norm(f.name + ' ' + (f.brand ?? ''));
    return words.every((w) => n.includes(w));
  });
}
