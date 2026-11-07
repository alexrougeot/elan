// Séances « type Hyrox » : cardio et renfo avec SkiErg, rameur, course, fentes, burpees…
// Trois formats, et le contenu change chaque semaine (le même pour tout le monde la même semaine).
import { daysBetween, dayKey, weekStart } from './dates';
import type { Sex } from './nutrition';

export type CircuitFormat = 'enchainement' | 'emom' | 'amrap' | 'wod';
type Unit = 'm' | 'cal' | 'reps';
type Cat = 'machine' | 'full' | 'legs' | 'carry';

type Move = {
  name: string;
  cat: Cat;
  unit: Unit;
  /** quantité de base pour chaque format */
  q: Record<Exclude<CircuitFormat, 'wod'>, number>;
  load?: { h: string; f: string };
  alt?: string;
};

export const MOVES: Record<string, Move> = {
  ski: { name: 'SkiErg', cat: 'machine', unit: 'm', q: { enchainement: 500, emom: 200, amrap: 250 }, alt: 'Pas de SkiErg libre : rameur, même distance' },
  row: { name: 'Rameur', cat: 'machine', unit: 'm', q: { enchainement: 500, emom: 200, amrap: 250 } },
  bike: { name: 'Vélo assault', cat: 'machine', unit: 'cal', q: { enchainement: 20, emom: 10, amrap: 12 }, alt: 'Pas de vélo assault : vélo classique, résistance haute' },
  burpee: { name: 'Burpees', cat: 'full', unit: 'reps', q: { enchainement: 20, emom: 10, amrap: 10 } },
  burpee_jump: { name: 'Burpees sautés vers l’avant', cat: 'full', unit: 'reps', q: { enchainement: 15, emom: 8, amrap: 8 } },
  thruster: { name: 'Thrusters haltères', cat: 'full', unit: 'reps', q: { enchainement: 20, emom: 12, amrap: 12 }, load: { h: '2 × 15 kg', f: '2 × 8 kg' } },
  mountain: { name: 'Mountain climbers', cat: 'full', unit: 'reps', q: { enchainement: 50, emom: 30, amrap: 30 } },
  lunge: { name: 'Fentes marchées haltères', cat: 'legs', unit: 'reps', q: { enchainement: 30, emom: 16, amrap: 20 }, load: { h: '2 × 12 kg', f: '2 × 8 kg' } },
  sandbag: { name: 'Fentes avec sac', cat: 'legs', unit: 'm', q: { enchainement: 50, emom: 20, amrap: 30 }, load: { h: '20 kg', f: '10 kg' }, alt: 'Pas de sac : une barre ou deux haltères' },
  wallball: { name: 'Wall balls', cat: 'legs', unit: 'reps', q: { enchainement: 40, emom: 15, amrap: 20 }, load: { h: '6 kg', f: '4 kg' } },
  boxjump: { name: 'Box jumps', cat: 'legs', unit: 'reps', q: { enchainement: 20, emom: 12, amrap: 15 }, alt: 'Ou step-ups, une jambe après l’autre' },
  goblet: { name: 'Goblet squats', cat: 'legs', unit: 'reps', q: { enchainement: 25, emom: 15, amrap: 15 }, load: { h: '24 kg', f: '16 kg' } },
  swing: { name: 'Kettlebell swings', cat: 'carry', unit: 'reps', q: { enchainement: 30, emom: 15, amrap: 20 }, load: { h: '24 kg', f: '16 kg' } },
  farmer: { name: 'Marche du fermier', cat: 'carry', unit: 'm', q: { enchainement: 100, emom: 50, amrap: 60 }, load: { h: '2 × 24 kg', f: '2 × 16 kg' } },
  bear: { name: 'Marche de l’ours', cat: 'carry', unit: 'm', q: { enchainement: 30, emom: 15, amrap: 20 } },
};

export type Item = { key: string; name: string; qty: number; unit: Unit; load?: string; alt?: string; run?: boolean };
export type CircuitPlan = {
  format: CircuitFormat;
  /** séance kettlebell à la maison (sinon type Hyrox) */
  kind?: 'kb';
  /** poids de la kettlebell */
  kg?: number;
  week: number;
  name: string;
  /** durée fixe (EMOM, AMRAP) ou estimée (enchaînement) */
  minutes: number;
  /** enchaînement : nombre de tours ; EMOM : nombre de passages */
  rounds: number;
  items: Item[];
  goal: string;
  duoRule: string;
};

export const FORMATS: Record<CircuitFormat, { name: string; short: string; about: string }> = {
  wod: { name: 'WOD', short: 'Pour le temps, avec 25 min max', about: 'Tout le travail à faire le plus vite possible.' },
  enchainement: { name: 'Enchaînement', short: 'Course + station, contre la montre', about: 'Le plus proche d’un Hyrox : une course, une station, et on recommence.' },
  emom: { name: 'EMOM', short: 'Un exercice chaque minute', about: 'Au bip, tu fais tes reps. Le reste de la minute, tu récupères.' },
  amrap: { name: 'AMRAP', short: 'Le plus de tours possible', about: 'Un circuit à répéter sans s’arrêter jusqu’à la fin du temps.' },
};

const EPOCH = '2026-01-05'; // un lundi

export function weekIndex(date = dayKey()) {
  return Math.floor(daysBetween(EPOCH, weekStart(date)) / 7);
}

/** Petit générateur pseudo-aléatoire : même semaine, même séance */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: T[], r: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const byCat = (c: Cat) => Object.keys(MOVES).filter((k) => MOVES[k].cat === c);

function roundQty(q: number, unit: Unit) {
  if (unit === 'm') return Math.max(10, Math.round(q / (q >= 200 ? 50 : 5)) * (q >= 200 ? 50 : 5));
  if (unit === 'cal') return Math.max(5, Math.round(q));
  return Math.max(4, Math.round(q / 2) * 2);
}

function item(key: string, format: CircuitFormat, factor: number, sex: Sex): Item {
  const m = MOVES[key];
  const f = format === 'wod' ? 'enchainement' : format;
  return { key, name: m.name, unit: m.unit, qty: roundQty(m.q[f] * factor, m.unit), load: m.load?.[sex], alt: m.alt };
}

/**
 * Séance de la semaine pour un format.
 * Cycle de 4 semaines : normal, +10 %, +20 % (plus long), puis semaine plus légère.
 */
export function circuitFor(format: CircuitFormat, week = weekIndex(), sex: Sex = 'h', duo = false): CircuitPlan {
  const phase = ((week % 4) + 4) % 4;
  const factor = [1, 1.1, 1.2, 0.85][phase] * (duo && format === 'emom' ? 1.3 : 1);
  const r = rng(week * 31 + (format === 'enchainement' ? 1 : format === 'emom' ? 2 : 3));
  const pick = (c: Cat, n: number) => shuffled(byCat(c), r).slice(0, n);

  if (format === 'enchainement') {
    const run = [600, 600, 800, 400][phase];
    const [m1, m2] = pick('machine', 2);
    const [l1, l2] = pick('legs', 2);
    const [f1] = pick('full', 1);
    const [c1] = pick('carry', 1);
    const stations = [m1, c1, f1, m2, l1, l2].map((k) => item(k, format, factor, sex));
    const items = stations.flatMap((s) => [{ key: 'run', name: 'Course', qty: run, unit: 'm' as Unit, run: true, alt: 'Sur tapis ou dehors' }, s]);
    const minutes = Math.round(6 * (run / 1000) * 5.5 + stations.length * 3.2);
    return {
      format,
      week,
      name: `Enchaînement · 6 tours`,
      minutes,
      rounds: 6,
      items,
      goal: `${run} m de course, puis la station. Six fois. Chrono du début à la fin.`,
      duoRule: 'À deux : vous courez ensemble, puis vous vous partagez les reps de chaque station comme vous voulez.',
    };
  }

  if (format === 'emom') {
    const [l1, l2] = pick('legs', 2);
    const keys = [pick('machine', 1)[0], pick('full', 1)[0], l1, pick('carry', 1)[0], l2];
    const rounds = [6, 6, 7, 5][phase];
    return {
      format,
      week,
      name: `EMOM · ${rounds * 5} min`,
      minutes: rounds * 5,
      rounds,
      items: keys.map((k) => item(k, format, factor, sex)),
      goal: 'Au bip de chaque minute, fais les reps du poste. Il doit te rester 15 à 20 s de repos.',
      duoRule: duo
        ? 'À deux : vous alternez les minutes (l’un travaille, l’autre souffle). Les reps sont augmentées de 30 % pour ça.'
        : 'À deux : vous alternez les minutes, l’un travaille pendant que l’autre souffle.',
    };
  }

  const minutes = [20, 20, 24, 16][phase];
  const first = r() < 0.5 ? { key: 'run', name: 'Course', qty: roundQty(300 * factor, 'm'), unit: 'm' as Unit, run: true, alt: 'Sur tapis ou dehors' } : item(pick('machine', 1)[0], format, factor, sex);
  const rest = [...pick('full', 1), ...pick('legs', 1), ...pick('carry', 1)].map((k) => item(k, format, factor, sex));
  return {
    format,
    week,
    name: `AMRAP · ${minutes} min`,
    minutes,
    rounds: 0,
    items: [first, ...rest],
    goal: `Enchaîne le circuit en boucle pendant ${minutes} minutes. Compte tes tours.`,
    duoRule: 'À deux : vous faites un tour chacun votre tour. Le score, ce sont vos tours à deux.',
  };
}

export function qtyText(i: Pick<Item, 'qty' | 'unit'>) {
  return i.unit === 'm' ? `${i.qty} m` : i.unit === 'cal' ? `${i.qty} cal` : `${i.qty}`;
}

export function itemText(i: Item) {
  return i.unit === 'reps' ? `${i.qty} ${i.name.toLowerCase()}` : `${i.name} · ${qtyText(i)}`;
}

// ---------------- Kettlebell à la maison : 25 minutes ----------------
type KbFamily = 'hinge' | 'squat' | 'push' | 'pull' | 'full';
type KbMove = { name: string; fam: KbFamily; q: { amrap: number; emom: number; wod: number }; kb?: boolean; side?: 'bras' | 'jambe'; alt?: string };

export const KB_MOVES: Record<string, KbMove> = {
  kb_swing: { name: 'Swings', fam: 'hinge', q: { amrap: 15, emom: 15, wod: 50 }, kb: true, alt: 'Hanches qui poussent, bras relâchés : la cloche monte à hauteur d’épaules.' },
  kb_deadlift: { name: 'Soulevés de terre', fam: 'hinge', q: { amrap: 12, emom: 14, wod: 40 }, kb: true },
  kb_highpull: { name: 'Tirages menton sumo', fam: 'hinge', q: { amrap: 10, emom: 12, wod: 30 }, kb: true },
  kb_snatch: { name: 'Arrachés alternés', fam: 'hinge', q: { amrap: 10, emom: 10, wod: 30 }, kb: true, alt: 'Change de bras à chaque rep.' },
  kb_goblet: { name: 'Goblet squats', fam: 'squat', q: { amrap: 12, emom: 12, wod: 40 }, kb: true },
  kb_thruster: { name: 'Thrusters goblet', fam: 'squat', q: { amrap: 10, emom: 10, wod: 30 }, kb: true, alt: 'Squat cloche contre la poitrine, puis tu pousses au-dessus de la tête.' },
  kb_lunge: { name: 'Fentes arrière goblet', fam: 'squat', q: { amrap: 12, emom: 12, wod: 40 }, kb: true, alt: 'En alternant les jambes, total des deux côtés.' },
  kb_press: { name: 'Clean and press', fam: 'push', q: { amrap: 5, emom: 5, wod: 15 }, kb: true, side: 'bras' },
  kb_pushpress: { name: 'Push press', fam: 'push', q: { amrap: 6, emom: 6, wod: 15 }, kb: true, side: 'bras' },
  pushup: { name: 'Pompes', fam: 'push', q: { amrap: 12, emom: 14, wod: 40 }, alt: 'Sur les genoux si besoin, mais poitrine au sol.' },
  kb_row: { name: 'Rowings', fam: 'pull', q: { amrap: 8, emom: 10, wod: 20 }, kb: true, side: 'bras', alt: 'Main libre sur le genou, dos plat.' },
  kb_gorilla: { name: 'Rowings gorille', fam: 'pull', q: { amrap: 12, emom: 14, wod: 40 }, kb: true, alt: 'Pieds écartés, cloche au sol entre les pieds, un bras puis l’autre.' },
  burpee: { name: 'Burpees', fam: 'full', q: { amrap: 8, emom: 10, wod: 30 } },
  kb_twist: { name: 'Russian twists', fam: 'full', q: { amrap: 16, emom: 20, wod: 40 }, kb: true, alt: 'Total des deux côtés.' },
  mountain_kb: { name: 'Mountain climbers', fam: 'full', q: { amrap: 24, emom: 30, wod: 60 }, alt: 'Total des deux jambes.' },
  kb_halo: { name: 'Halos', fam: 'full', q: { amrap: 8, emom: 10, wod: 20 }, kb: true, alt: 'Un tour autour de la tête = 1, en alternant le sens.' },
};

export const KB_FORMATS: CircuitFormat[] = ['amrap', 'wod', 'emom'];
export const KB_WEIGHTS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32];

function kbItem(key: string, qty: number, kg: number): Item {
  const m = KB_MOVES[key];
  const q = Math.max(m.side ? 3 : 4, Math.round(qty));
  return {
    key,
    name: m.side ? `${m.name} (${q} par ${m.side})` : m.name,
    unit: 'reps',
    qty: m.side ? q * 2 : q,
    load: m.kb ? `${kg} kg` : undefined,
    alt: m.alt,
  };
}

/** Texte d'un poste kettlebell : « 15 swings », « Clean and press (5 par bras) » */
export function kbText(i: Item) {
  return /\(\d+ par /.test(i.name) ? i.name : `${i.qty} ${i.name.toLowerCase()}`;
}

/**
 * Séance kettlebell de la semaine : AMRAP 25 min, EMOM 25 min (5 postes × 5) ou WOD pour le temps (25 min max).
 * Même cycle de 4 semaines que les séances type Hyrox ; le contenu change chaque lundi.
 */
export function kbFor(format: 'amrap' | 'emom' | 'wod', week = weekIndex(), kg = 16): CircuitPlan {
  const phase = ((week % 4) + 4) % 4;
  const factor = [1, 1.1, 1.2, 0.85][phase];
  const r = rng(week * 53 + (format === 'amrap' ? 7 : format === 'emom' ? 11 : 13));
  const fam = (f: KbFamily) => shuffled(Object.keys(KB_MOVES).filter((k) => KB_MOVES[k].fam === f), r)[0];
  const base = { kind: 'kb' as const, kg, week, duoRule: 'À deux : chacun sa kettlebell, ou vous alternez les tours.' };

  if (format === 'amrap') {
    const keys = [fam('hinge'), fam('squat'), r() < 0.5 ? fam('push') : fam('pull'), fam('full')];
    return {
      ...base,
      format,
      name: 'AMRAP · 25 min',
      minutes: 25,
      rounds: 0,
      items: keys.map((k) => kbItem(k, KB_MOVES[k].q.amrap * factor, kg)),
      goal: 'Enchaîne le circuit en boucle pendant 25 minutes. Compte tes tours, et vise un rythme que tu tiens jusqu’au bout.',
    };
  }

  if (format === 'emom') {
    const keys = [fam('hinge'), fam('squat'), fam('push'), fam('pull'), fam('full')];
    return {
      ...base,
      format,
      name: 'EMOM · 25 min',
      minutes: 25,
      rounds: 5,
      items: keys.map((k) => kbItem(k, KB_MOVES[k].q.emom * factor, kg)),
      goal: 'Au bip de chaque minute, fais les reps du poste. Cinq postes, cinq tours. Il doit te rester 15 à 20 s pour souffler.',
    };
  }

  // WOD pour le temps : une semaine sur deux un « chipper », sinon une pyramide 21-15-9
  if (week % 2 === 0) {
    const keys = [fam('hinge'), fam('squat'), fam('push'), fam('pull'), fam('full'), 'kb_swing'];
    const uniq = [...new Set(keys)];
    for (const k of shuffled(Object.keys(KB_MOVES), r)) if (uniq.length < 6 && !uniq.includes(k)) uniq.push(k);
    const shares = [1, 0.85, 0.75, 0.75, 0.7, 0.6];
    const items = uniq.slice(0, 6).map((k, i) => kbItem(k, KB_MOVES[k].q.wod * factor * shares[i], kg));
    return {
      ...base,
      format,
      name: 'WOD · chipper',
      minutes: 25,
      rounds: items.length,
      items,
      goal: 'Chaque bloc en entier avant de passer au suivant, le plus vite possible. 25 minutes maximum.',
    };
  }
  // pyramide descendante sur 4 exercices : environ 20 minutes (plus courte la semaine légère)
  const keys = [fam('hinge'), fam('squat'), fam('push'), fam('pull')];
  const ladder = [[21, 18, 15, 12, 9], [21, 18, 15, 12, 9, 6], [24, 20, 16, 12, 8], [15, 12, 9]][phase];
  const items: Item[] = [];
  for (const n of ladder)
    for (const k of keys) {
      const m = KB_MOVES[k];
      items.push(kbItem(k, m.side ? n / 2 : n, kg));
    }
  return {
    ...base,
    format,
    name: `WOD · ${ladder.join('-')}`,
    minutes: 25,
    rounds: ladder.length,
    items,
    goal: `${ladder.join(', ')} reps de chaque exercice, dans l’ordre, le plus vite possible. 25 minutes maximum.`,
  };
}
