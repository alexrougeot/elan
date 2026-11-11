// Records : le défi contre soi-même. Poids, muscu, course, kettlebell, type Hyrox, montre, régularité.
import { allOf, getData } from './store';
import { addDays, dayKey, daysBetween, fmtKg, weekStart } from './dates';
import { weighIns, weekAvg, type Profile } from './nutrition';
import { e1rm, sessions } from './coach';
import { CATALOG, exName, isBodyweight, type Program } from './program';
import { activities, chrono, circuitScore, durationSec, paceText, runs, type Activity } from './activity';
import type { CircuitFormat } from './conditioning';
import type { HealthEntry } from './health';

export type Rec = { key: string; label: string; text: string; date: string; sub?: string; id?: string; /** a battu un résultat plus ancien */ beat?: boolean };
export type RecGroup = { title: string; icon: string; items: Rec[] };

const kmText = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km`;
const signed = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' });

/** Un record est « nouveau » pendant 7 jours, s'il a battu un résultat plus ancien */
export const isFresh = (r: Rec, days = 7) => !!r.beat && daysBetween(r.date, dayKey()) < days;
const minDate = (dates: string[]) => dates.reduce((a, b) => (b < a ? b : a), dates[0] ?? '');

// ---------------- Circuits : type Hyrox et kettlebell ----------------
type Scored = { id: string; a: Activity; value: number; text: string };

function complete(a: Activity) {
  const p = a.plan!;
  if (p.format === 'enchainement' || p.format === 'wod') return (a.splits?.length ?? 0) >= p.items.length;
  return true;
}

/** Score comparable : plus grand = meilleur */
function scoreOf(a: Activity): number {
  const p = a.plan!;
  if (p.format === 'enchainement' || p.format === 'wod') return -(a.splits ?? []).reduce((x, y) => x + y, 0);
  if (p.format === 'emom') return (p.minutes - (a.missed?.length ?? 0)) * 1000 + (p.kg ?? 0);
  return (a.rounds ?? 0) * 1000 + (a.extra ?? 0);
}

/** Les WOD changent de forme (chipper, pyramide) : on ne compare que la même forme */
function family(a: Activity) {
  const p = a.plan!;
  return p.format === 'wod' ? p.name : p.format;
}

function circuitsOf(kind: 'hyrox' | 'kb') {
  return activities().filter((d) => d.data.type === 'circuit' && d.data.endedAt && d.data.plan && (d.data.plan.kind === 'kb') === (kind === 'kb') && complete(d.data));
}

function bestOf(list: { id: string; data: Activity }[]): Scored | null {
  let best: Scored | null = null;
  for (const d of list) {
    const v = scoreOf(d.data);
    if (!best || v > best.value || (v === best.value && d.data.date < best.a.date)) best = { id: d.id, a: d.data, value: v, text: circuitScore(d.data) + (d.data.plan?.kg ? ` · ${d.data.plan.kg} kg` : '') };
  }
  return best;
}

/** Record d'un format (le meilleur score), ou null s'il n'a jamais été fait */
export function circuitRecord(format: CircuitFormat, kind: 'hyrox' | 'kb', name?: string) {
  const list = circuitsOf(kind).filter((d) => d.data.plan!.format === format && (!name || format !== 'wod' || d.data.plan!.name === name));
  const b = bestOf(list);
  return b ? { id: b.id, date: b.a.date, text: b.text, value: b.value } : null;
}

/** Message à afficher si la séance qu'on vient de finir bat le record d'avant */
export function newRecordText(before: { value: number; text: string } | null, a: Activity) {
  if (!before || !a.plan) return null;
  if (a.plan.format === 'wod') {
    const prev = circuitsOf(a.plan.kind === 'kb' ? 'kb' : 'hyrox').filter((d) => d.data.plan!.name === a.plan!.name && d.data.startedAt !== a.startedAt);
    const b = bestOf(prev);
    if (!b || scoreOf(a) <= b.value) return null;
    return `Nouveau record en ${a.plan.name} : ${circuitScore(a)}${a.plan.kg ? ` · ${a.plan.kg} kg` : ''} (avant : ${b.text}). Énorme !`;
  }
  if (scoreOf(a) <= before.value) return null;
  return `Nouveau record en ${a.plan.format === 'emom' ? 'EMOM' : a.plan.format === 'amrap' ? 'AMRAP' : 'enchaînement'} : ${circuitScore(a)}${a.plan.kg ? ` · ${a.plan.kg} kg` : ''} (avant : ${before.text}). Énorme !`;
}

function circuitGroup(kind: 'hyrox' | 'kb'): RecGroup | null {
  const all = circuitsOf(kind);
  if (!all.length) return null;
  const items: Rec[] = [];
  const fams = [...new Set(all.map((d) => family(d.data)))];
  const order = (f: string) => (f === 'amrap' ? 0 : f === 'emom' ? 2 : f === 'enchainement' ? 3 : 1);
  for (const f of fams.sort((a, b) => order(a) - order(b))) {
    const fam = all.filter((d) => family(d.data) === f);
    const b = bestOf(fam);
    if (!b) continue;
    const first = minDate(fam.map((d) => d.data.date));
    const p = b.a.plan!;
    const label = p.format === 'amrap' ? 'AMRAP : le plus de tours' : p.format === 'emom' ? 'EMOM : minutes réussies' : p.format === 'wod' ? `${p.name} : meilleur temps` : 'Enchaînement : meilleur temps';
    items.push({ key: `${kind}:${f}`, label, text: b.text, date: b.a.date, id: b.id, beat: fam.length > 1 && b.a.date > first });
  }
  if (kind === 'kb') {
    const heavy = all.reduce((x, d) => ((d.data.plan?.kg ?? 0) > (x.data.plan?.kg ?? 0) ? d : x));
    if (heavy.data.plan?.kg) items.push({ key: 'kb:kg', label: 'Kettlebell la plus lourde', text: `${heavy.data.plan.kg} kg`, date: heavy.data.date, beat: all.some((d) => (d.data.plan?.kg ?? 0) < heavy.data.plan!.kg! && d.data.date < heavy.data.date) });
  }
  items.push({ key: `${kind}:count`, label: 'Séances terminées', text: String(all.length), date: all[0].data.date });
  return { title: kind === 'kb' ? 'Kettlebell' : 'Type Hyrox', icon: kind === 'kb' ? 'kettlebell' : 'bolt', items };
}

// ---------------- Poids ----------------
function weightGroup(): RecGroup | null {
  const list = weighIns();
  if (!list.length) return null;
  const profile = getData<Profile>('profile');
  const items: Rec[] = [];
  const down = profile?.goal === 'seche';
  const top = list.reduce((a, b) => (down ? (b.kg < a.kg ? b : a) : b.kg >= a.kg ? b : a));
  items.push({ key: 'w:top', label: down ? 'Poids le plus bas' : 'Poids le plus haut', text: `${fmtKg(top.kg)} kg`, date: top.date, beat: top.date > list[0].date });
  // meilleure semaine (moyennes)
  let best: { d: number; monday: string } | null = null;
  let firstWeek = '';
  let m = weekStart(list[0].date);
  const end = weekStart(dayKey());
  while (m < end) {
    const a = weekAvg(m, list);
    const b = weekAvg(addDays(m, -7), list);
    if (a !== undefined && b !== undefined) {
      const d = a - b;
      if (!firstWeek) firstWeek = m;
      if (!best || (down ? d < best.d : d > best.d)) best = { d, monday: m };
    }
    m = addDays(m, 7);
  }
  if (best) items.push({ key: 'w:week', label: down ? 'Plus grosse perte en une semaine' : 'Plus grosse prise en une semaine', text: `${signed(best.d)} kg`, date: addDays(best.monday, 6), sub: 'moyenne de la semaine', beat: best.monday > firstWeek });
  // pesées d'affilée
  let run = 1;
  let bestRun = 1;
  let bestEnd = list[0].date;
  for (let i = 1; i < list.length; i++) {
    run = daysBetween(list[i - 1].date, list[i].date) === 1 ? run + 1 : 1;
    if (run >= bestRun) {
      bestRun = run;
      bestEnd = list[i].date;
    }
  }
  const last = list[list.length - 1];
  const current = daysBetween(last.date, dayKey()) <= 1 ? run : 0;
  items.push({ key: 'w:streak', label: 'Pesées d’affilée', text: `${bestRun} jour${bestRun > 1 ? 's' : ''}`, date: bestEnd, sub: current > 1 && current < bestRun ? `en cours : ${current} jours` : current === bestRun && current > 1 ? 'série en cours' : undefined });
  if (list.length > 1) items.push({ key: 'w:total', label: 'Depuis la première pesée', text: `${signed(last.kg - list[0].kg)} kg`, date: last.date, sub: `en ${daysBetween(list[0].date, last.date)} jours` });
  return { title: 'Poids', icon: 'scale', items };
}

// ---------------- Musculation ----------------
function strengthGroup(): RecGroup | null {
  const done = sessions().filter((s) => s.data.endedAt);
  if (!done.length) return null;
  const items: Rec[] = [];
  let vol = { v: 0, date: '', title: '' };
  for (const s of done) {
    let v = 0;
    for (const e of s.data.exercises) for (const x of e.sets) if (x.done && x.w > 0 && !CATALOG[e.key]?.timed) v += x.w * x.r;
    if (v > vol.v) vol = { v, date: s.data.date, title: s.data.title };
  }
  if (vol.v) items.push({ key: 's:vol', label: 'Plus grosse séance', text: `${Math.round(vol.v).toLocaleString('fr-FR')} kg soulevés`, date: vol.date, sub: vol.title, beat: vol.date > minDate(done.map((s) => s.data.date)) });

  // semaines complètes d'affilée
  const program = getData<Program>('program');
  if (program?.days.length) {
    const moves = getData<Record<string, string | null>>('moves') ?? {};
    const dates = new Set(done.map((s) => s.data.date));
    let m = weekStart(program.startDate);
    const thisWeek = weekStart(dayKey());
    let run = 0;
    let bestRun = 0;
    let bestEnd = '';
    while (m <= thisWeek) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(m, i));
      const count = days.filter((d) => dates.has(d)).length;
      const skipped = days.filter((d) => moves[d] === null).length;
      const need = Math.max(1, program.days.length - skipped);
      const ok = count >= need;
      if (m === thisWeek && !ok) break; // semaine en cours pas encore finie
      run = ok ? run + 1 : 0;
      if (run > 0 && run >= bestRun) {
        bestRun = run;
        bestEnd = addDays(m, 6) > dayKey() ? dayKey() : addDays(m, 6);
      }
      m = addDays(m, 7);
    }
    if (bestRun > 0) items.push({ key: 's:weeks', label: 'Semaines complètes d’affilée', text: `${bestRun} semaine${bestRun > 1 ? 's' : ''}`, date: bestEnd, sub: run === bestRun ? 'série en cours' : run > 0 ? `en cours : ${run}` : undefined });
  }
  items.push({ key: 's:count', label: 'Séances de muscu faites', text: String(done.length), date: done[0].data.date });

  // force : max estimé par exercice (les gros d'abord)
  const best = new Map<string, { v: number; w: number; r: number; date: string }>();
  const firstOf = new Map<string, string>();
  for (const s of done)
    for (const e of s.data.exercises) {
      if (CATALOG[e.key]?.timed) continue;
      for (const x of e.sets) {
        if (!x.done || x.w <= 0) continue;
        if (!firstOf.has(e.key) || s.data.date < firstOf.get(e.key)!) firstOf.set(e.key, s.data.date);
        const v = e1rm(x.w, x.r);
        const cur = best.get(e.key);
        if (!cur || v > cur.v) best.set(e.key, { v, w: x.w, r: x.r, date: s.data.date });
      }
    }
  const main = ['squat', 'bench', 'deadlift', 'ohp', 'row', 'rdl', 'hip_thrust', 'pullup', 'incline_db', 'leg_press'];
  const keys = [...best.keys()].sort((a, b) => {
    const ia = main.indexOf(a);
    const ib = main.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return best.get(b)!.v - best.get(a)!.v;
  });
  for (const k of keys.slice(0, 8)) {
    const b = best.get(k)!;
    items.push({ key: 'f:' + k, label: exName(k), text: `${Math.round(b.v)} kg max estimé`, date: b.date, sub: `meilleure série : ${fmtKg(b.w, b.w % 1 ? 1 : 0)} kg × ${b.r}`, beat: b.date > (firstOf.get(k) ?? b.date) });
  }
  // poids du corps sans lest (tractions, dips…) : le plus de reps en une série
  const reps = new Map<string, { r: number; date: string; first: string }>();
  for (const s of [...done].reverse())
    for (const e of s.data.exercises) {
      if (!isBodyweight(e.key) || best.has(e.key)) continue;
      for (const x of e.sets) {
        if (!x.done || x.w > 0) continue;
        const cur = reps.get(e.key);
        if (!cur) reps.set(e.key, { r: x.r, date: s.data.date, first: s.data.date });
        else if (x.r > cur.r) reps.set(e.key, { ...cur, r: x.r, date: s.data.date });
      }
    }
  for (const [k, b] of reps) items.push({ key: 'f:' + k, label: exName(k), text: `${b.r} reps`, date: b.date, sub: 'meilleure série, au poids du corps', beat: b.date > b.first });
  return { title: 'Musculation', icon: 'dumbbell', items };
}

// ---------------- Course ----------------
function runGroup(): RecGroup | null {
  const list = runs().filter((r) => r.data.km && r.data.km > 0);
  if (!list.length) return null;
  const items: Rec[] = [];
  const first = minDate(list.map((r) => r.data.date));
  const far = list.reduce((a, b) => (b.data.km! > a.data.km! ? b : a));
  items.push({ key: 'r:far', label: 'Plus longue sortie', text: kmText(far.data.km!), date: far.data.date, id: far.id, beat: far.data.date > first });
  const paced = list.filter((r) => r.data.km! >= 3);
  if (paced.length) {
    const fast = paced.reduce((a, b) => (durationSec(b.data) / b.data.km! < durationSec(a.data) / a.data.km! ? b : a));
    items.push({ key: 'r:pace', label: 'Meilleure allure (3 km et plus)', text: paceText(durationSec(fast.data) / fast.data.km!), date: fast.data.date, sub: kmText(fast.data.km!), id: fast.id, beat: fast.data.date > minDate(paced.map((r) => r.data.date)) });
  }
  for (const dist of [5, 10]) {
    let best: { t: number; date: string; id: string; est: boolean } | null = null;
    for (const r of list) {
      const s = r.data.kmSplits ?? [];
      let t: number | null = null;
      let est = false;
      if (s.length >= dist) {
        for (let i = 0; i + dist <= s.length; i++) {
          const sum = s.slice(i, i + dist).reduce((x, y) => x + y, 0);
          if (t === null || sum < t) t = sum;
        }
      } else if (r.data.km! >= dist) {
        t = (durationSec(r.data) / r.data.km!) * dist;
        est = true;
      }
      if (t !== null && (!best || t < best.t)) best = { t, date: r.data.date, id: r.id, est };
    }
    if (best) items.push({ key: 'r:' + dist, label: `Meilleur ${dist} km`, text: chrono(best.t), date: best.date, sub: best.est ? 'à ton allure moyenne' : undefined, id: best.id, beat: best.date > first });
  }
  const climb = list.filter((r) => r.data.elev).reduce<{ id: string; data: Activity } | null>((a, b) => (!a || b.data.elev! > a.data.elev! ? b : a), null);
  if (climb) items.push({ key: 'r:elev', label: 'Plus gros dénivelé', text: `${climb.data.elev} m`, date: climb.data.date, id: climb.id, beat: climb.data.date > first });
  // plus de km en une semaine
  const weeks = new Map<string, number>();
  for (const r of list) weeks.set(weekStart(r.data.date), (weeks.get(weekStart(r.data.date)) ?? 0) + r.data.km!);
  const [wk, km] = [...weeks.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  items.push({ key: 'r:week', label: 'Plus de kilomètres en une semaine', text: kmText(km), date: addDays(wk, 6) > dayKey() ? dayKey() : addDays(wk, 6), beat: weeks.size > 1 && wk > weekStart(first) });
  return { title: 'Course', icon: 'run', items };
}

// ---------------- Montre ----------------
function watchGroup(): RecGroup | null {
  type W = { kcal?: number | null; hrMax?: number | null; minutes?: number; date: string; what: string };
  const list: W[] = [
    ...allOf<HealthEntry>('health').map((d) => ({ kcal: d.data.kcal, hrMax: d.data.hrMax, minutes: d.data.minutes, date: d.data.date, what: d.data.title ?? d.data.name ?? 'Entraînement' })),
    ...activities()
      .filter((d) => d.data.kcal || d.data.hrMax)
      .map((d) => ({ kcal: d.data.kcal, hrMax: d.data.hrMax, minutes: Math.round(durationSec(d.data) / 60), date: d.data.date, what: d.data.plan?.name ?? (d.data.type === 'course' ? 'Course' : d.data.name ?? 'Activité') })),
  ];
  if (!list.length) return null;
  const items: Rec[] = [];
  const first = minDate(list.map((w) => w.date));
  const burn = list.filter((w) => w.kcal).reduce<W | null>((a, b) => (!a || b.kcal! > a.kcal! ? b : a), null);
  if (burn) items.push({ key: 'm:kcal', label: 'Plus de calories en une séance', text: `${burn.kcal} kcal`, date: burn.date, sub: burn.what, beat: burn.date > first });
  const heart = list.filter((w) => w.hrMax).reduce<W | null>((a, b) => (!a || b.hrMax! > a.hrMax! ? b : a), null);
  if (heart) items.push({ key: 'm:hr', label: 'Cœur le plus haut', text: `${heart.hrMax} bpm`, date: heart.date, sub: heart.what, beat: heart.date > first });
  const long = list.filter((w) => w.minutes).reduce<W | null>((a, b) => (!a || b.minutes! > a.minutes! ? b : a), null);
  if (long?.minutes) items.push({ key: 'm:long', label: 'Plus longue séance', text: long.minutes >= 60 ? `${Math.floor(long.minutes / 60)} h ${String(long.minutes % 60).padStart(2, '0')}` : `${long.minutes} min`, date: long.date, sub: long.what, beat: long.date > first });
  return { title: 'Montre', icon: 'heart', items };
}

export function allRecords(): RecGroup[] {
  return [weightGroup(), strengthGroup(), runGroup(), circuitGroup('kb'), circuitGroup('hyrox'), watchGroup()].filter((g): g is RecGroup => !!g && g.items.length > 0);
}

/** Records battus aujourd'hui ou hier (pour l'accueil) — hors compteurs */
export function freshRecords(days = 2) {
  return allRecords()
    .flatMap((g) => g.items.map((r) => ({ ...r, group: g.title })))
    .filter((r) => isFresh(r, days) && !/:count$|w:total/.test(r.key));
}
