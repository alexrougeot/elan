import { useSyncExternalStore } from 'react';
import { getData, getDoc, putDoc, uid } from './store';
import { dayKey, weekday } from './dates';
import { CATALOG, type Program, type ProgramDay } from './program';
import { bestE1rm, e1rm, isDeloadWeek, prepareExercise, sessions, type Session } from './coach';
import { beep } from './device';

export function getProgram() {
  return getData<Program>('program');
}

export function planFor(program: Program | undefined, d = new Date()) {
  return program?.days.find((x) => x.weekday === weekday(d));
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

export async function startSession(day: ProgramDay, program: Program) {
  const id = 'session:' + uid();
  const deload = isDeloadWeek(program);
  const s: Session = {
    date: dayKey(),
    dayId: day.id,
    title: day.title,
    subtitle: day.subtitle,
    startedAt: new Date().toISOString(),
    deload,
    exercises: day.exercises.map((p) => prepareExercise(p, deload, id)),
  };
  await putDoc(id, 'session', s);
  return id;
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
