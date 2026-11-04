// « Je mange quoi ? » : une assiette d'aliments de base qui complète les macros du repas.
import type { FoodItem } from './foods';
import type { Macros } from './nutrition';
import { countText, type PortionChoice } from './portions';

type Base = { code: number; name: string; short: string; k: number; p: number; g: number; l: number; max: number; step: number; unit?: [string, string, number]; min?: number };
const B = (code: number, name: string, short: string, k: number, p: number, g: number, l: number, max: number, step = 10, unit?: [string, string, number]): Base => ({
  code,
  name,
  short,
  k,
  p,
  g,
  l,
  max,
  step,
  unit,
});

// Valeurs pour 100 g, table Ciqual de l'Anses
const F = {
  oeufDur: B(22010, 'Oeuf, dur', 'œufs durs', 134, 13.5, 0.5, 8.6, 200, 50, ['œuf dur', 'œufs durs', 50]),
  oeufPlat: B(22505, 'Oeuf, au plat, sans matière grasse', 'œufs au plat', 147, 13.8, 1.0, 9.7, 200, 50, ['œuf au plat', 'œufs au plat', 50]),
  jambonDinde: B(28964, 'Jambon de dinde ou Blanc de dinde en tranche', 'jambon de dinde', 104, 20.9, 1.3, 1.7, 150, 30, ['tranche de jambon de dinde', 'tranches de jambon de dinde', 30]),
  fbl3: B(19646, 'Fromage blanc nature, 3% MG environ', 'fromage blanc', 78, 8.0, 3.5, 3.3, 300),
  fbl0: B(19644, 'Fromage blanc nature, 0% MG', 'fromage blanc 0 %', 50, 8.0, 3.9, 0.0, 300),
  poulet: B(36018, 'Poulet, filet, sans peau, sauté/poêlé', 'poulet', 141, 30.1, 0.0, 2.0, 250),
  dinde: B(36306, 'Dinde, escalope, sautée/poêlée', 'dinde', 124, 28.5, 0.0, 1.1, 250),
  boeuf: B(6253, 'Boeuf, steak haché 10% MG, cuit', 'steak haché 10 %', 210, 26.1, 0.0, 11.8, 200),
  saumon: B(26038, 'Saumon, cuit à la vapeur', 'saumon', 195, 23.0, 0.0, 11.5, 200),
  thon: B(26039, 'Thon, au naturel, appertisé, égoutté', 'thon au naturel', 111, 26.8, 0.0, 0.4, 200),
  painComplet: B(7110, 'Pain complet ou intégral (à la farine T150)', 'pain complet', 241, 8.4, 44.3, 1.8, 175, 35, ['tranche de pain complet', 'tranches de pain complet', 35]),
  painMie: B(7111, 'Pain de mie, complet', 'pain de mie complet', 259, 8.5, 43.7, 4.1, 150, 25, ['tranche de pain de mie complet', 'tranches de pain de mie complet', 25]),
  avoine: B(9311, "Flocon d'avoine", 'flocons d’avoine', 364, 13.3, 57.9, 6.5, 120),
  riz: B(9104, 'Riz blanc, cuit, non salé', 'riz cuit', 144, 2.9, 31.8, 0.4, 450),
  rizComplet: B(9103, 'Riz complet, cuit, non salé', 'riz complet cuit', 157, 3.2, 32.6, 1.0, 450),
  pates: B(9811, 'Pâtes sèches standard, cuites, non salées', 'pâtes cuites', 125, 4.0, 25.0, 0.6, 500),
  pdt: B(4003, "Pomme de terre, bouillie/cuite à l'eau", 'pommes de terre', 80, 1.8, 16.7, 0.3, 600),
  quinoa: B(9341, "Quinoa, bouilli/cuit à l'eau, non salé", 'quinoa cuit', 148, 4.7, 27.9, 1.1, 450),
  lentilles: B(20505, "Lentille, bouillie/cuite à l'eau", 'lentilles cuites', 104, 9.0, 12.2, 0.4, 400),
  banane: B(13005, 'Banane, pulpe, crue', 'banane', 90, 1.1, 19.7, 0.2, 240, 60, ['banane', 'bananes', 120]),
  pomme: B(13039, 'Pomme, pulpe et peau, crue', 'pomme', 53, 0.2, 11.6, 0.2, 300, 150, ['pomme', 'pommes', 150]),
  huile: B(17270, "Huile d'olive vierge extra", 'huile d’olive', 900, 0.2, 0.0, 99.9, 20, 5, ['cuillère à café d’huile d’olive', 'cuillères à café d’huile d’olive', 5]),
  amandes: B(15000, 'Amande (avec peau)', 'amandes', 600, 18.8, 9.5, 51.3, 40, 5),
  avocat: B(13004, 'Avocat, pulpe, cru', 'avocat', 205, 1.6, 0.8, 20.6, 130, 65, ['avocat', 'avocats', 130]),
  emmental: B(12115, 'Emmental ou emmenthal', 'emmental', 375, 27.9, 0.0, 28.8, 40, 10),
  haricots: B(20320, "Haricot vert, bouilli/cuit à l'eau", 'haricots verts', 28, 1.8, 3.4, 0.1, 200),
  brocoli: B(20006, 'Brocoli, cuit', 'brocoli', 23, 2.1, 1.1, 0.8, 200),
  courgette: B(20021, 'Courgette, pulpe et peau, cuite', 'courgettes', 16, 0.9, 1.4, 0.4, 200),
};

// Portions minimales réalistes pour les protéines
const MINS: [Base, number][] = [
  [F.oeufDur, 100],
  [F.oeufPlat, 100],
  [F.jambonDinde, 60],
  [F.fbl3, 100],
  [F.fbl0, 100],
  [F.poulet, 100],
  [F.dinde, 100],
  [F.boeuf, 100],
  [F.saumon, 100],
  [F.thon, 80],
];
for (const [b, m] of MINS) b.min = m;
F.riz.max = 400;
F.rizComplet.max = 400;
F.pates.max = 400;
F.pdt.max = 450;
F.quinoa.max = 400;

type Kind = 'breakfast' | 'post' | 'lunch' | 'snack' | 'dinner';
const PLANS: Record<Kind, { P: Base[]; C: Base[]; L: Base[]; V: Base[] }> = {
  breakfast: { P: [F.oeufPlat, F.jambonDinde, F.oeufDur, F.fbl3], C: [F.painComplet, F.painMie], L: [F.avocat, F.emmental], V: [] },
  post: { P: [F.poulet, F.jambonDinde, F.thon, F.fbl3], C: [F.painComplet, F.banane, F.riz], L: [], V: [] },
  lunch: { P: [F.poulet, F.boeuf, F.saumon, F.dinde, F.thon, F.oeufDur], C: [F.riz, F.pates, F.pdt, F.quinoa, F.rizComplet, F.lentilles], L: [F.huile, F.avocat], V: [F.haricots, F.brocoli, F.courgette] },
  dinner: { P: [F.saumon, F.dinde, F.poulet, F.boeuf, F.oeufDur], C: [F.pates, F.riz, F.pdt, F.quinoa, F.lentilles], L: [F.huile, F.avocat], V: [F.courgette, F.haricots, F.brocoli] },
  snack: { P: [F.fbl3, F.fbl0, F.jambonDinde], C: [F.banane, F.avoine, F.pomme, F.painComplet], L: [F.amandes, F.emmental], V: [] },
};

export function mealKind(name: string, time: string): Kind {
  const [h, m] = time.split(':').map(Number);
  const t = h + m / 60;
  if (/séance|seance|sport/i.test(name)) return 'post';
  if (t < 10) return 'breakfast';
  if (t < 14.5) return 'lunch';
  if (t < 18) return 'snack';
  return 'dinner';
}

export type IdeaItem = { food: FoodItem; grams: number; portion?: PortionChoice; text: string };
export type Idea = { items: IdeaItem[]; total: Macros };

function toItem(b: Base, grams: number): IdeaItem {
  const food: FoodItem = { name: b.name, per100: { k: b.k, p: b.p, g: b.g, l: b.l }, src: 'ciqual', ref: 'ciqual:' + b.code };
  if (b.unit) {
    const [one, many, ug] = b.unit;
    const count = Math.round((grams / ug) * 2) / 2;
    const por = { one, many, grams: ug, count };
    return { food, grams, portion: por, text: countText(count, por) };
  }
  const de = /^[aeiouyœéèêâîô]|^huile/i.test(b.short) ? 'd’' : 'de ';
  return { food, grams, text: `${grams} g ${de}${b.short}` };
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/** Assiette n°`variant` pour atteindre `goal` (macros restantes du repas) */
export function mealIdea(kind: Kind, goal: Macros, variant = 0): Idea | null {
  if (goal.k < 80) return null;
  const plan = PLANS[kind];
  const pick = <T,>(list: T[], shift: number) => (list.length ? list[(variant + shift) % list.length] : undefined);
  const P = pick(plan.P, 0);
  const C = pick(plan.C, Math.floor(variant / Math.max(1, plan.P.length)));
  const L = goal.l > 4 ? pick(plan.L, variant) : undefined;
  const V = pick(plan.V, variant);
  const vg = V ? 150 : 0;

  let xp = 0;
  let xc = 0;
  let xl = 0;
  const v = (b: Base | undefined, x: number, key: 'p' | 'g' | 'l') => (b ? (b[key] * x) / 100 : 0);
  for (let i = 0; i < 5; i++) {
    xp = P ? Math.max(P.min ?? 0, ((goal.p - v(C, xc, 'p') - v(L, xl, 'p') - v(V, vg, 'p')) / P.p) * 100) : 0;
    xc = C ? Math.max(0, ((goal.g - v(P, xp, 'g') - v(L, xl, 'g') - v(V, vg, 'g')) / C.g) * 100) : 0;
    xl = L ? Math.max(0, ((goal.l - v(P, xp, 'l') - v(C, xc, 'l') - v(V, vg, 'l')) / L.l) * 100) : 0;
  }

  const items: IdeaItem[] = [];
  const add = (b: Base | undefined, x: number) => {
    if (!b) return;
    const g = Math.min(b.max, roundTo(x, b.step));
    if (g >= b.step) items.push(toItem(b, g));
  };
  add(P, xp);
  add(C, xc);
  // féculent au maximum : on complète avec du pain
  if (C && C !== F.painComplet && (kind === 'lunch' || kind === 'dinner')) {
    const cg = Math.min(C.max, roundTo(xc, C.step));
    const missing = goal.g - (C.g * cg) / 100 - v(P, xp, 'g') - v(V, vg, 'g');
    if (missing > 15) add(F.painComplet, Math.min(105, (missing / F.painComplet.g) * 100));
  }
  if (V) items.push(toItem(V, vg));
  add(L, xl);
  if (items.length === 0) return null;

  const total = items.reduce(
    (a, it) => ({
      k: a.k + (it.food.per100.k * it.grams) / 100,
      p: a.p + (it.food.per100.p * it.grams) / 100,
      g: a.g + (it.food.per100.g * it.grams) / 100,
      l: a.l + (it.food.per100.l * it.grams) / 100,
    }),
    { k: 0, p: 0, g: 0, l: 0 }
  );
  return { items, total };
}

