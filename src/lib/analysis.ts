// Analyse de l'entraînement : volume par muscle, progression, muscles à prioriser.
import { CATALOG } from './program';
import { e1rm, sessions } from './coach';
import { addDays, dayKey, daysBetween, weekStart } from './dates';

export const GROUPS = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets'] as const;
export type Group = (typeof GROUPS)[number];

export function groupOf(key: string): Group | null {
  const m = CATALOG[key]?.muscle;
  if (!m) return null;
  if (m === 'Dos et jambes') return 'Dos';
  if (m === 'Quadriceps et fessiers') return 'Quadriceps';
  return (GROUPS as readonly string[]).includes(m) ? (m as Group) : null;
}

function finished() {
  return sessions().filter((s) => s.data.endedAt);
}

/** Séries faites par muscle, pour les `weeks` dernières semaines (la plus récente en premier) */
export function weeklySets(weeks = 4) {
  const thisMonday = weekStart(dayKey());
  const out = Array.from({ length: weeks }, (_, i) => ({ monday: addDays(thisMonday, -7 * i), sets: {} as Partial<Record<Group, number>> }));
  for (const s of finished()) {
    const w = out.find((x) => s.data.date >= x.monday && s.data.date <= addDays(x.monday, 6));
    if (!w) continue;
    for (const e of s.data.exercises) {
      const g = groupOf(e.key);
      if (!g || e.planned.circuit) continue;
      w.sets[g] = (w.sets[g] ?? 0) + e.sets.filter((x) => x.done).length;
    }
  }
  return out;
}

/**
 * Progression par muscle : évolution moyenne du max estimé de ses exercices,
 * entre le début et la fin des 6 dernières semaines.
 */
export function progressByMuscle() {
  const since = addDays(dayKey(), -42);
  const perExercise = new Map<string, { date: string; v: number }[]>();
  for (const s of [...finished()].reverse()) {
    if (s.data.date < since) continue;
    for (const e of s.data.exercises) {
      if (CATALOG[e.key]?.timed || e.planned.circuit) continue;
      let best = 0;
      for (const x of e.sets) if (x.done && x.w > 0) best = Math.max(best, e1rm(x.w, x.r));
      if (best > 0) perExercise.set(e.key, [...(perExercise.get(e.key) ?? []), { date: s.data.date, v: best }]);
    }
  }
  const byGroup = new Map<Group, number[]>();
  let span = 0;
  for (const [key, pts] of perExercise) {
    if (pts.length < 3) continue;
    const g = groupOf(key);
    if (!g) continue;
    span = Math.max(span, daysBetween(pts[0].date, pts[pts.length - 1].date));
    const first = (pts[0].v + pts[1].v) / 2;
    const last = (pts[pts.length - 1].v + pts[pts.length - 2].v) / 2;
    byGroup.set(g, [...(byGroup.get(g) ?? []), ((last - first) / first) * 100]);
  }
  const result = [...byGroup.entries()].map(([group, list]) => ({ group, pct: list.reduce((a, b) => a + b, 0) / list.length }));
  return { result: result.sort((a, b) => a.pct - b.pct), span };
}

/** Muscles à prioriser : ceux qui progressent le moins (2 au maximum), après 3 semaines de données */
export function focusMuscles(): Group[] {
  const { result, span } = progressByMuscle();
  if (span < 21 || result.length < 3) return [];
  const avg = result.reduce((a, b) => a + b.pct, 0) / result.length;
  return result
    .filter((r) => r.pct < 1 || r.pct < avg - 3)
    .slice(0, 2)
    .map((r) => r.group);
}
