// Objectifs nutritionnels, repas de la journée et ajustement hebdomadaire.
import { allOf, getData, putDoc } from './store';
import { addDays, dayKey, parseDay, weekStart } from './dates';

export type Sex = 'h' | 'f';
export type Goal = 'masse' | 'maintien' | 'seche';
export type Profile = {
  name: string;
  sex: Sex;
  age: number;
  height: number;
  weight: number;
  goal: Goal;
  goalWeight: number;
  activity: number;
  createdAt: string;
};

export type Meal = { name: string; time: string; share: { p: number; g: number; l: number }; hint?: string };
export type Adjustment = { date: string; week: string; delta: number; reason: string; undone?: boolean };
export type Targets = { kcal: number; p: number; g: number; l: number; meals: Meal[]; mode: 'auto' | 'manuel'; history: Adjustment[] };

export type Macros = { k: number; p: number; g: number; l: number };
export type FoodEntry = {
  date: string;
  meal: number;
  name: string;
  brand?: string;
  grams: number;
  per100: Macros;
  src: 'ciqual' | 'off' | 'perso';
  ref?: string;
  at: string;
};

export const GOALS: Record<Goal, string> = { masse: 'Prise de masse', maintien: 'Maintien', seche: 'Sèche' };

const round5 = (x: number) => Math.round(x / 5) * 5;

export function bmr(p: Pick<Profile, 'sex' | 'age' | 'height' | 'weight'>) {
  // Mifflin-St Jeor
  return 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'h' ? 5 : -161);
}

export function computeTargets(p: Profile): Pick<Targets, 'kcal' | 'p' | 'g' | 'l'> {
  const tdee = bmr(p) * p.activity;
  const delta = p.goal === 'masse' ? 300 : p.goal === 'seche' ? -400 : 0;
  const kcal = Math.round((tdee + delta) / 100) * 100;
  const prot = round5(p.weight * (p.goal === 'seche' ? 2.2 : p.goal === 'masse' ? 2.0 : 1.8));
  const lip = round5(p.weight * (p.goal === 'seche' ? 0.9 : p.goal === 'masse' ? 1.15 : 1.0));
  const glu = Math.max(0, Math.round((kcal - prot * 4 - lip * 9) / 4));
  return { kcal, p: prot, g: glu, l: lip };
}

// Répartition décidée avec l'utilisateur (en grammes sur 140 P / 430 G / 80 L)
export function defaultMeals(): Meal[] {
  const m = (name: string, time: string, p: number, g: number, l: number, hint: string): Meal => ({
    name,
    time,
    share: { p: p / 140, g: g / 430, l: l / 80 },
    hint,
  });
  return [
    m('Petit déjeuner', '06:00', 30, 90, 18, 'Salé : pain complet, œufs, jambon de dinde. Léger en gras avant la séance.'),
    m('Après la séance', '08:30', 30, 65, 8, 'Sandwich poulet ou dinde, ou whey avec du pain et un fruit.'),
    m('Déjeuner', '12:30', 35, 120, 22, 'Grosse portion de riz ou de pâtes, viande ou poisson, légumes.'),
    m('Collation', '16:00', 15, 50, 15, 'Fruit, amandes et skyr, ou pain et fromage.'),
    m('Dîner', '19:30', 30, 105, 17, 'Féculents, protéine, légumes.'),
  ];
}

export function getTargets(): Targets | undefined {
  return getData<Targets>('targets');
}

export function kcalOf(m: { p: number; g: number; l: number }) {
  return Math.round(m.p * 4 + m.g * 4 + m.l * 9);
}

export function mealTarget(t: Targets, i: number): Macros {
  const s = t.meals[i]?.share ?? { p: 0.2, g: 0.2, l: 0.2 };
  const p = Math.round(t.p * s.p);
  const g = Math.round(t.g * s.g);
  const l = Math.round(t.l * s.l);
  return { k: kcalOf({ p, g, l }), p, g, l };
}

export function entryMacros(e: Pick<FoodEntry, 'grams' | 'per100'>): Macros {
  const f = e.grams / 100;
  return { k: e.per100.k * f, p: e.per100.p * f, g: e.per100.g * f, l: e.per100.l * f };
}

export function sum(list: Macros[]): Macros {
  return list.reduce((a, b) => ({ k: a.k + b.k, p: a.p + b.p, g: a.g + b.g, l: a.l + b.l }), { k: 0, p: 0, g: 0, l: 0 });
}

export function foodsOn(date: string) {
  return allOf<FoodEntry>('food')
    .filter((d) => d.data.date === date)
    .sort((a, b) => (a.data.at < b.data.at ? -1 : 1));
}

export function totalsOn(date: string) {
  return sum(foodsOn(date).map((d) => entryMacros(d.data)));
}

// ---- Pesée ----
export type WeighIn = { date: string; kg: number };

export function weighIns() {
  return allOf<WeighIn>('weight')
    .map((d) => d.data)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Moyenne des pesées sur les 7 jours qui finissent à `end` (au moins 1 pesée) */
export function avg7(end = dayKey(), list = weighIns()) {
  const start = addDays(end, -6);
  const w = list.filter((x) => x.date >= start && x.date <= end);
  if (w.length === 0) return undefined;
  return w.reduce((a, b) => a + b.kg, 0) / w.length;
}

/** Moyenne d'une semaine (lundi → dimanche), au moins 3 pesées */
export function weekAvg(monday: string, list = weighIns()) {
  const end = addDays(monday, 6);
  const w = list.filter((x) => x.date >= monday && x.date <= end);
  if (w.length < 3) return undefined;
  return w.reduce((a, b) => a + b.kg, 0) / w.length;
}

export function currentWeight(profile?: Profile) {
  const list = weighIns();
  return avg7(dayKey(), list) ?? list[list.length - 1]?.kg ?? profile?.weight;
}

/** Variation de poids des deux dernières semaines complètes */
export function weeklyGains(today = dayKey()) {
  const list = weighIns();
  const thisMonday = weekStart(today);
  const w1 = addDays(thisMonday, -7);
  const w2 = addDays(thisMonday, -14);
  const w3 = addDays(thisMonday, -21);
  const a1 = weekAvg(w1, list);
  const a2 = weekAvg(w2, list);
  const a3 = weekAvg(w3, list);
  return {
    last: a1 !== undefined && a2 !== undefined ? a1 - a2 : undefined,
    before: a2 !== undefined && a3 !== undefined ? a2 - a3 : undefined,
    lastAvg: a1,
  };
}

/** Règles d'ajustement décidées avec l'utilisateur */
export function adjustmentFor(goal: Goal, g1?: number, g2?: number): { delta: number; reason: string } | null {
  if (g1 === undefined) return null;
  const f = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1, signDisplay: 'always' });
  if (goal === 'masse') {
    if (g1 > 0.5) return { delta: -150, reason: `${f(g1)} kg la semaine dernière, c’est trop rapide : −150 kcal pour rester propre.` };
    if (g2 !== undefined && g1 < 0.2 && g2 < 0.2) return { delta: 150, reason: `Moins de 0,2 kg pris deux semaines de suite : +150 kcal en glucides.` };
  } else if (goal === 'seche') {
    if (g1 < -1) return { delta: 150, reason: `${f(g1)} kg la semaine dernière, c’est trop rapide : +150 kcal.` };
    if (g2 !== undefined && g1 > -0.25 && g2 > -0.25) return { delta: -150, reason: `Moins de 0,25 kg perdu deux semaines de suite : −150 kcal.` };
  } else if (g2 !== undefined && Math.abs(g1) > 0.3 && Math.sign(g1) === Math.sign(g2)) {
    return { delta: g1 > 0 ? -100 : 100, reason: `Ton poids bouge depuis deux semaines : ${g1 > 0 ? '−' : '+'}100 kcal pour te stabiliser.` };
  }
  return null;
}

/** Applique l'ajustement de la semaine une seule fois, en mode automatique */
export async function runWeeklyAdjustment(profile: Profile) {
  const t = getTargets();
  if (!t || t.mode !== 'auto') return null;
  const week = weekStart(dayKey());
  if (t.history.some((h) => h.week === week)) return null;
  const { last, before } = weeklyGains();
  const adj = adjustmentFor(profile.goal, last, before);
  if (!adj) return null;
  const next = applyDelta(t, adj.delta);
  next.history = [...t.history, { date: dayKey(), week, delta: adj.delta, reason: adj.reason }];
  await putDoc('targets', 'targets', next);
  return adj;
}

export function applyDelta(t: Targets, delta: number): Targets {
  // On ajuste par les glucides, comme convenu
  const g = Math.max(0, t.g + Math.round(delta / 4));
  return { ...t, g, kcal: kcalOf({ p: t.p, g, l: t.l }) };
}

export async function undoAdjustment(index: number) {
  const t = getTargets();
  if (!t) return;
  const h = t.history[index];
  if (!h || h.undone) return;
  const next = applyDelta(t, -h.delta);
  next.history = t.history.map((x, i) => (i === index ? { ...x, undone: true } : x));
  await putDoc('targets', 'targets', next);
}

/** Date d'arrivée estimée à l'objectif, au rythme donné (kg / semaine) */
export function eta(from: number, to: number, ratePerWeek: number) {
  const diff = Math.abs(to - from);
  if (diff < 0.1 || ratePerWeek <= 0) return null;
  const weeks = diff / ratePerWeek;
  const d = new Date();
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

export function targetRate(goal: Goal) {
  return goal === 'masse' ? 0.3 : goal === 'seche' ? 0.5 : 0;
}

export function isSunday(key = dayKey()) {
  return parseDay(key).getDay() === 0;
}
