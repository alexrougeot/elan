import { useSyncExternalStore } from 'react';
import { getData, getDoc, putDoc, uid } from './store';
import { dayKey, daysBetween, parseDay, weekday } from './dates';
import { CATALOG, weeklyCircuit, type Program, type ProgramDay } from './program';
import { focusMuscles, groupOf } from './analysis';
import { bestE1rm, e1rm, isDeloadWeek, prepareExercise, sessions, type Session } from './coach';
import { beep } from './device';

export function getProgram() {
  return getData<Program>('program');
}

/**
 * Changements ponctuels du planning : { date: id de la séance à faire ce jour-là, ou null = pas de séance }.
 * Sert à sauter ou décaler une séance sans toucher au programme.
 */
export type Moves = Record<string, string | null>;
export function getMoves(): Moves {
  return getData<Moves>('moves') ?? {};
}

export function planFor(program: Program | undefined, d = new Date()) {
  const moves = getMoves();
  const key = dayKey(d);
  if (key in moves) {
    const id = moves[key];
    return id ? program?.days.find((x) => x.id === id) : undefined;
  }
  return program?.days.find((x) => x.weekday === weekday(d));
}

/** La séance prévue normalement ce jour-là (sans tenir compte des changements) */
export function usualPlan(program: Program | undefined, d = new Date()) {
  return program?.days.find((x) => x.weekday === weekday(d));
}

async function saveMoves(next: Moves) {
  // on ne garde que les 60 derniers jours
  const limit = dayKey(new Date(Date.now() - 60 * 864e5));
  await putDoc('moves', 'moves', Object.fromEntries(Object.entries(next).filter(([k]) => k >= limit)));
}

/** Sauter la séance d'aujourd'hui, et la refaire un autre jour si `to` est donné */
export async function skipDay(dayId: string, from = dayKey(), to?: string) {
  const next = { ...getMoves(), [from]: null };
  if (to) next[to] = dayId;
  await saveMoves(next);
}

/** Revenir au planning normal pour ce jour (et annuler le report lié) */
export async function undoSkip(date = dayKey()) {
  const moves = getMoves();
  const program = getProgram();
  const usual = usualPlan(program, parseDay(date));
  const next: Moves = {};
  for (const [k, v] of Object.entries(moves)) {
    if (k === date) continue;
    if (usual && v === usual.id && k > date) continue;
    next[k] = v;
  }
  await saveMoves(next);
}

export function extraFor(program: Program | undefined, d = new Date()) {
  return program?.extras.find((x) => x.weekday === weekday(d));
}

export function activeSession() {
  const s = sessions().find((x) => !x.data.endedAt);
  if (!s) return undefined;
  // une séance oubliée depuis plus de 14 h est considérée comme terminée
  if (Date.now() - new Date(s.data.startedAt).getTime() > 14 * 3600_000) return undefined;
  return s;
}

export function sessionToday(dayId?: string) {
  const today = dayKey();
  return sessions().find((x) => x.data.date === today && (!dayId || x.data.dayId === dayId));
}

/** Forme du jour : 1 (épuisé) à 5 (au top) */
export type Readiness = 1 | 2 | 3 | 4 | 5;

export async function startSession(day: ProgramDay, program: Program, readiness: Readiness = 3) {
  const id = 'session:' + uid();
  const deload = isDeloadWeek(program);
  const focus = focusMuscles();
  const focused = new Set<string>();
  let pushed = false;
  const exercises = day.exercises.map((p) => {
    if (p.circuit) {
      // le circuit abdos change chaque semaine
      const week = Math.max(0, Math.floor(daysBetween(program.startDate, dayKey()) / 7));
      const dayIndex = Math.max(0, program.days.findIndex((d) => d.id === day.id));
      const c = weeklyCircuit(p.circuit, week, dayIndex, program.days.length, deload);
      return prepareExercise({ ...p, circuit: c }, deload, id);
    }
    const def = CATALOG[p.key];
    const g = groupOf(p.key);
    // muscle en retard : +1 série sur son premier exercice de la séance
    const boost = !deload && readiness >= 3 && g && focus.includes(g) && !focused.has(g);
    if (boost && g) focused.add(g);
    const ex = prepareExercise(boost ? { ...p, sets: p.sets + 1 } : p, deload, id);
    if (boost) ex.tip = { ...ex.tip, text: `Focus ${g?.toLowerCase()} : ils progressent moins vite que le reste, alors +1 série cette semaine. ` + ex.tip.text };

    // forme du jour
    const step = def && def.increment >= 2.5 ? 2.5 : 1;
    const round = (x: number) => Math.max(0, Math.round(x / step) * step);
    if (!def?.timed && ex.sets.some((x) => x.w > 0)) {
      if (readiness === 1) {
        ex.sets = ex.sets.slice(0, Math.max(2, ex.sets.length - 1)).map((x) => ({ ...x, w: round(x.w * 0.9) }));
        ex.tip = { kind: 'deload', text: 'Grosse fatigue aujourd’hui : une série de moins et −10 %. Le but, c’est de garder le rythme sans te cramer.' };
      } else if (readiness === 2) {
        ex.sets = ex.sets.map((x) => ({ ...x, w: round(x.w * 0.95) }));
        ex.tip = { ...ex.tip, text: 'Un peu fatigué : −5 % sur les charges. ' + ex.tip.text };
      } else if (readiness === 5 && !pushed && def?.compound && ex.tip.kind !== 'down' && ex.tip.kind !== 'new') {
        pushed = true;
        const inc = def.increment || 2.5;
        ex.sets = ex.sets.map((x) => ({ ...x, w: round(x.w + inc) }));
        ex.tip = { kind: 'up', text: `Tu es au top : on tente +${inc.toLocaleString('fr-FR')} kg sur ce premier gros exercice. Si ça passe, c’est gagné pour la suite.` };
      }
    }
    return ex;
  });
  const s: Session = {
    date: dayKey(),
    dayId: day.id,
    title: day.title,
    subtitle: day.subtitle,
    startedAt: new Date().toISOString(),
    deload,
    readiness,
    exercises,
  };
  await putDoc(id, 'session', s);
  return id;
}

/** Séries d'échauffement calculées sur la charge du jour */
export function warmupsFor(key: string, work: number, bar = 20): { w: number; r: number }[] {
  const def = CATALOG[key];
  if (!def || def.timed || !def.compound || work <= 0) return [];
  if (!['barre', 'machine', 'haltères'].includes(def.equipment)) return [];
  const barbell = def.equipment === 'barre';
  const step = barbell || def.equipment === 'machine' ? 2.5 : 1;
  const round = (x: number) => Math.round(x / step) * step;
  const floor = barbell ? bar : step;
  const plan: [number, number][] = work >= 60 ? [[0.4, 8], [0.6, 5], [0.8, 3]] : work >= 35 ? [[0.5, 8], [0.75, 4]] : [[0.6, 8]];
  const out: { w: number; r: number }[] = [];
  for (const [pct, r] of plan) {
    const w = Math.max(floor, round(work * pct));
    if (w < work && !out.some((o) => o.w === w)) out.push({ w, r });
  }
  if (barbell && out.length && out[0].w > bar && work >= 60) out.unshift({ w: bar, r: 10 });
  return out.slice(0, 4);
}

export async function updateSession(id: string, fn: (s: Session) => Session) {
  const cur = getDoc<Session>(id);
  if (!cur) return;
  await putDoc(id, 'session', fn(structuredClone(cur.data)));
}

export function sessionStats(s: Session) {
  let sets = 0;
  let volume = 0;
  const prs: string[] = [];
  for (const e of s.exercises) {
    for (const x of e.sets) {
      if (!x.done) continue;
      sets++;
      volume += x.w * x.r;
    }
  }
  return { sets, volume, prs };
}

/** Records battus dans cette séance (max estimé supérieur à tout l'historique d'avant) */
export function sessionRecords(id: string, s: Session) {
  const out: { key: string; w: number; r: number }[] = [];
  for (const e of s.exercises) {
    if (CATALOG[e.key]?.timed) continue;
    const prev = bestE1rm(e.key, id);
    if (prev <= 0) continue;
    let best: { w: number; r: number; v: number } | null = null;
    for (const x of e.sets) if (x.done && e1rm(x.w, x.r) > prev && (!best || e1rm(x.w, x.r) > best.v)) best = { w: x.w, r: x.r, v: e1rm(x.w, x.r) };
    if (best) out.push({ key: e.key, w: best.w, r: best.r });
  }
  return out;
}

// ---------- Chrono de repos ----------
type Rest = { endsAt: number; total: number; label: string } | null;
let rest: Rest = (() => {
  try {
    const r = JSON.parse(localStorage.getItem('elan.rest') || 'null');
    return r && r.endsAt > Date.now() - 60_000 ? r : null;
  } catch {
    return null;
  }
})();
let fired = false;
const restListeners = new Set<() => void>();

function saveRest() {
  try {
    localStorage.setItem('elan.rest', JSON.stringify(rest));
  } catch {
    /* rien */
  }
  restListeners.forEach((l) => l());
}

export function useRest() {
  return useSyncExternalStore(
    (l) => {
      restListeners.add(l);
      return () => restListeners.delete(l);
    },
    () => rest
  );
}

export function startRest(seconds: number, label: string) {
  rest = { endsAt: Date.now() + seconds * 1000, total: seconds, label };
  fired = false;
  saveRest();
}

export function adjustRest(delta: number) {
  if (!rest) return;
  rest = { ...rest, endsAt: rest.endsAt + delta * 1000, total: Math.max(5, rest.total + delta) };
  if (rest.endsAt > Date.now()) fired = false;
  saveRest();
}

export function stopRest() {
  rest = null;
  saveRest();
}

let soundOn = true;
export function setRestSound(on: boolean) {
  soundOn = on;
}

setInterval(() => {
  if (!rest) return;
  const left = rest.endsAt - Date.now();
  if (left <= 0 && !fired) {
    fired = true;
    if (soundOn) beep();
    restListeners.forEach((l) => l());
  }
  if (left < -20_000) stopRest();
}, 250);

// ---------- Ordre des séries (supersets enchaînés) ----------
export type SetRef = { ei: number; sj: number };

/** Membres du même superset que l'exercice ei (lui compris) */
export function groupMembers(s: Session, ei: number) {
  const g = s.exercises[ei]?.planned.group;
  if (!g) return [ei];
  return s.exercises.map((x, k) => (x.planned.group === g ? k : -1)).filter((k) => k >= 0);
}

/** Ordre de la séance : dans un superset, série 1 de A, série 1 de B, puis série 2… */
export function setOrder(s: Session): SetRef[] {
  const out: SetRef[] = [];
  const seen = new Set<number>();
  s.exercises.forEach((_, i) => {
    if (seen.has(i)) return;
    const members = groupMembers(s, i);
    members.forEach((k) => seen.add(k));
    const rounds = Math.max(...members.map((k) => s.exercises[k].sets.length));
    for (let j = 0; j < rounds; j++) for (const k of members) if (j < s.exercises[k].sets.length) out.push({ ei: k, sj: j });
  });
  return out;
}

export function nextPending(s: Session): SetRef | undefined {
  return setOrder(s).find((p) => !s.exercises[p.ei].sets[p.sj].done);
}
