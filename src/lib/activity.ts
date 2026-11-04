// Activités en dehors du programme : course (importée de Santé ou notée à la main),
// séances type Hyrox, vélo, natation…
import { allOf, getData, putDoc, removeDoc, uid } from './store';
import { dayKey } from './dates';
import type { Profile } from './nutrition';
import type { CircuitPlan } from './conditioning';
import { healthOn } from './health';

export type ActivityType = 'course' | 'circuit' | 'cours' | 'velo' | 'natation' | 'marche' | 'autre';
export type Activity = {
  date: string;
  type: ActivityType;
  minutes: number;
  km?: number;
  /** ressenti : 1 facile, 2 moyen, 3 dur */
  rpe?: number;
  /** fait à deux */
  duo?: boolean;
  note?: string;
  startedAt?: string;
  /** vide tant qu'une séance type Hyrox est en cours */
  endedAt?: string;
  // ---- importé de Santé (Health Auto Export) ----
  source?: string;
  name?: string;
  kcal?: number;
  hrAvg?: number;
  hrMax?: number;
  /** dénivelé positif en mètres */
  elev?: number;
  /** parcours : [lat, lon, secondes depuis le départ, altitude] */
  route?: number[][];
  /** temps de chaque kilomètre, en secondes */
  kmSplits?: number[];
  // ---- séance type Hyrox ----
  plan?: CircuitPlan;
  /** enchaînement : temps de chaque segment (s) */
  splits?: number[];
  /** EMOM : minutes ratées (numéros à partir de 1) */
  missed?: number[];
  /** AMRAP : tours complets et reps en plus */
  rounds?: number;
  extra?: number;
  at: string;
};

export const ACTIVITY: Record<ActivityType, { label: string; icon: string; distance: boolean; met: number }> = {
  course: { label: 'Course', icon: 'run', distance: true, met: 9.8 },
  circuit: { label: 'Type Hyrox', icon: 'bolt', distance: false, met: 9 },
  cours: { label: 'Cours collectif', icon: 'users', distance: false, met: 7 },
  velo: { label: 'Vélo', icon: 'run', distance: true, met: 7.5 },
  natation: { label: 'Natation', icon: 'drop', distance: true, met: 7 },
  marche: { label: 'Marche', icon: 'run', distance: true, met: 3.8 },
  autre: { label: 'Autre', icon: 'flame', distance: false, met: 6 },
};

export function activities() {
  return allOf<Activity>('activity')
    .filter((d) => d.data.type !== 'circuit' || d.data.endedAt)
    .sort((a, b) => (a.data.date === b.data.date ? ((a.data.startedAt ?? a.data.at) < (b.data.startedAt ?? b.data.at) ? 1 : -1) : a.data.date < b.data.date ? 1 : -1));
}

export function activitiesOn(date = dayKey()) {
  return activities().filter((a) => a.data.date === date);
}

export function runs() {
  return activities().filter((a) => a.data.type === 'course');
}

export async function saveActivity(a: Omit<Activity, 'at'>, id = 'activity:' + uid()) {
  await putDoc(id, 'activity', { ...a, at: new Date().toISOString() });
  return id;
}

export const deleteActivity = (id: string) => removeDoc(id);

/** Durée exacte en secondes (début et fin si on les a) */
export function durationSec(a: Activity) {
  if (a.startedAt && a.endedAt && a.type !== 'circuit') {
    const s = (new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime()) / 1000;
    if (s > 0) return s;
  }
  return a.minutes * 60;
}

/** Dépense : celle de la montre si on l'a, sinon 1 kcal par kilo et par km en course, sinon MET × poids × durée */
export function activityKcal(a: Activity, kg = getData<Profile>('profile')?.weight ?? 70) {
  if (a.kcal) return a.kcal;
  if (a.type === 'course' && a.km) return Math.round(kg * a.km * 1.0);
  const intensity = a.rpe === 1 ? 0.8 : a.rpe === 3 ? 1.15 : 1;
  return Math.round(ACTIVITY[a.type].met * intensity * kg * (a.minutes / 60));
}

/**
 * En prise de masse, une grosse dépense en plus se compense : on rajoute environ la moitié
 * (le reste est déjà compté dans le niveau d'activité du profil).
 */
export function fuelBonus(kcal: number, goal: Profile['goal'] = 'masse') {
  if (goal !== 'masse' || kcal < 250) return 0;
  return Math.round((kcal * 0.5) / 50) * 50;
}

/**
 * Dépense des activités en plus du programme sur une journée.
 * La montre a le dernier mot : si elle a mesuré un entraînement, on prend sa valeur plutôt que l'estimation.
 */
export function dayBurn(date = dayKey(), kg?: number) {
  const acts = activitiesOn(date).map((d) => d.data);
  const measured = acts.filter((a) => a.kcal).reduce((x, a) => x + (a.kcal ?? 0), 0);
  const estimated = acts.filter((a) => !a.kcal).reduce((x, a) => x + activityKcal(a, kg), 0);
  const watch = healthOn(date)
    .filter((h) => !h.sessionId && h.kcal)
    .reduce((x, h) => x + (h.kcal ?? 0), 0);
  const burn = measured + Math.max(watch, estimated);
  const fromWatch = measured > 0 || (watch > 0 && watch >= estimated);
  return { burn, fromWatch, watch, estimated, measured };
}

/** Objectif du jour : la base + la moitié de ce que les activités en plus ont brûlé (en glucides) */
export function dayBonus(date = dayKey(), goal: Profile['goal'] = 'masse', kg?: number) {
  const b = dayBurn(date, kg);
  return { ...b, bonus: fuelBonus(b.burn, goal) };
}

/** Allure en secondes par km */
export function paceSec(a: Activity) {
  if (!a.km || a.km <= 0) return 0;
  return durationSec(a) / a.km;
}

export function paceText(secPerKm: number) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
}

export function pace(minutes: number, km?: number) {
  if (!km || km <= 0 || minutes <= 0) return '';
  return paceText((minutes * 60) / km);
}

export function chrono(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function fmtDuration(sec: number) {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

/** Score lisible d'une séance type Hyrox */
export function circuitScore(a: Activity) {
  const p = a.plan;
  if (!p) return '';
  if (p.format === 'enchainement') return chrono((a.splits ?? []).reduce((x, y) => x + y, 0));
  if (p.format === 'emom') return `${p.minutes - (a.missed?.length ?? 0)} / ${p.minutes} min réussies`;
  return `${a.rounds ?? 0} tour${(a.rounds ?? 0) > 1 ? 's' : ''}${a.extra ? ` + ${a.extra} reps` : ''}`;
}

export function activityLine(a: Activity) {
  if (a.type === 'circuit') return `${a.plan?.name ?? 'Séance'} · ${circuitScore(a)}${a.duo ? ' · à deux' : ''}`;
  const parts = [fmtDuration(durationSec(a))];
  if (a.km) parts.unshift(`${a.km.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km`);
  if (a.type === 'course' && a.km) parts.push(paceText(paceSec(a)));
  if (a.duo) parts.push('à deux');
  return parts.join(' · ');
}

export function activeCircuit() {
  return allOf<Activity>('activity').find((d) => d.data.type === 'circuit' && !d.data.endedAt);
}

// Demande d'ouverture depuis l'accueil (bouton « Hyrox »)
let circuitAsked = false;
export function askCircuit() {
  circuitAsked = true;
}
export function takeCircuitAsk() {
  const v = circuitAsked;
  circuitAsked = false;
  return v;
}
