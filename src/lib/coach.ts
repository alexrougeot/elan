// Coach charges : double progression, comme décidé avec l'utilisateur.
import { allOf } from './store';
import { CATALOG, type PlannedExercise, type Program } from './program';
import { daysBetween, dayKey, fmtWeight } from './dates';

export type SetEntry = { w: number; r: number; done: boolean; at?: string };
export type CoachTip = { text: string; kind: 'up' | 'same' | 'down' | 'new' | 'deload' };
export type SessionExercise = {
  key: string;
  planned: PlannedExercise;
  sets: SetEntry[];
  tip: CoachTip;
  swappedFrom?: string;
};
export type Session = {
  date: string;
  dayId: string;
  title: string;
  subtitle: string;
  startedAt: string;
  endedAt?: string;
  deload?: boolean;
  exercises: SessionExercise[];
};

export function sessions() {
  return allOf<Session>('session').sort((a, b) => (a.data.startedAt < b.data.startedAt ? 1 : -1));
}

/** Les dernières fois où cet exercice a été fait (plus récent d'abord) */
export function historyFor(key: string, excludeId?: string) {
  const out: { sessionId: string; date: string; ex: SessionExercise }[] = [];
  for (const s of sessions()) {
    if (s.id === excludeId) continue;
    for (const e of s.data.exercises) {
      if (e.key === key && e.sets.some((x) => x.done)) out.push({ sessionId: s.id, date: s.data.date, ex: e });
    }
  }
  return out;
}

export function e1rm(w: number, r: number) {
  if (w <= 0 || r <= 0) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

export function bestE1rm(key: string, excludeId?: string) {
  let best = 0;
  for (const h of historyFor(key, excludeId)) for (const s of h.ex.sets) if (s.done) best = Math.max(best, e1rm(s.w, s.r));
  return best;
}

export function bestWeight(key: string, excludeId?: string) {
  let best = 0;
  for (const h of historyFor(key, excludeId)) for (const s of h.ex.sets) if (s.done) best = Math.max(best, s.w);
  return best;
}

function roundTo(x: number, step: number) {
  return Math.max(0, Math.round(x / step) * step);
}

function failed(ex: SessionExercise) {
  const done = ex.sets.filter((s) => s.done);
  return done.length < ex.planned.sets || done.some((s) => s.r < ex.planned.min);
}

export function isDeloadWeek(program: Program, today = dayKey()) {
  if (!program.deloadEvery) return false;
  const week = Math.floor(daysBetween(program.startDate, today) / 7);
  return week > 0 && (week + 1) % program.deloadEvery === 0;
}

/** Prépare les séries d'un exercice à partir de l'historique */
export function prepareExercise(planned: PlannedExercise, deload: boolean, excludeId?: string): SessionExercise {
  const def = CATALOG[planned.key];
  const step = def && def.increment >= 2.5 ? 2.5 : 1;
  const hist = historyFor(planned.key, excludeId);
  const sets = deload ? Math.max(2, planned.sets - 1) : planned.sets;
  const timed = !!def?.timed;

  if (hist.length === 0) {
    return {
      key: planned.key,
      planned,
      sets: Array.from({ length: sets }, () => ({ w: 0, r: planned.min, done: false })),
      tip: {
        kind: 'new',
        text: timed
          ? `Première fois : tiens entre ${planned.min} et ${planned.max} secondes.`
          : 'Première fois : choisis une charge qui te laisse 1 ou 2 reps en réserve. Je m’en sers ensuite pour la suite.',
      },
    };
  }

  const last = hist[0].ex;
  const before = hist[1]?.ex;
  const done = last.sets.filter((s) => s.done);
  const top = Math.max(...done.map((s) => s.w));
  const lastReps = done.map((s) => s.r);
  const allTop = done.length >= last.planned.sets && done.every((s) => s.r >= planned.max);
  const fail = failed(last);
  const failBefore = before ? failed(before) : false;

  let w = top;
  let reps: number[] = Array.from({ length: sets }, (_, i) => Math.min(planned.max, (lastReps[i] ?? lastReps[lastReps.length - 1] ?? planned.min) + (timed ? 5 : 1)));
  let tip: CoachTip;

  if (timed) {
    tip = allTop
      ? { kind: 'same', text: `Tu as tenu ${planned.max} s partout : passe à une variante plus dure ou garde ce temps.` }
      : { kind: 'same', text: 'Vise 5 secondes de plus que la dernière fois.' };
  } else if (fail && failBefore) {
    w = roundTo(top * 0.9, step);
    reps = Array.from({ length: sets }, () => planned.min);
    tip = { kind: 'down', text: `Deux séances difficiles de suite : on repart à ${fmtWeight(w)} kg (−10 %) pour remonter proprement.` };
  } else if (allTop) {
    const inc = def?.increment ?? (def?.lower ? 5 : 2.5);
    w = top + inc;
    reps = Array.from({ length: sets }, () => planned.min);
    tip = {
      kind: 'up',
      text: top === 0 ? `${planned.max} reps partout : ajoute ${fmtWeight(inc)} kg de lest.` : `${planned.max} reps partout la dernière fois : +${fmtWeight(inc)} kg aujourd’hui.`,
    };
  } else if (fail) {
    reps = Array.from({ length: sets }, (_, i) => Math.max(planned.min, lastReps[i] ?? planned.min));
    tip = { kind: 'same', text: 'Séance dure la dernière fois : même charge, on consolide.' };
  } else {
    tip = { kind: 'same', text: `Même charge, vise une rep de plus par série (jusqu’à ${planned.max}).` };
  }

  if (deload && !timed) {
    w = roundTo(w * 0.9, step);
    tip = { kind: 'deload', text: `Semaine légère : ${sets} séries à ${fmtWeight(w)} kg, sans aller à l’échec. Ton corps récupère et repart plus fort.` };
  }

  return { key: planned.key, planned, sets: reps.map((r) => ({ w, r, done: false })), tip };
}
