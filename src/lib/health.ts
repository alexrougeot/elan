// Données de la montre (Apple Watch ou Garmin), lues dans Santé par un raccourci iPhone.
import { supabase, SUPABASE_URL } from './supabase';
import { allOf, getData, putDoc } from './store';

export type HealthEntry = {
  date: string;
  sessionId: string | null;
  title: string | null;
  kcal: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  minutes: number;
  source: string;
  at: string;
};

export const SHORTCUT_NAME = 'Élan montre';
export const SANTE_URL = SUPABASE_URL + '/functions/v1/sante';

export function healthForSession(sessionId: string) {
  return getData<HealthEntry>('health:' + sessionId.replace('session:', ''));
}

export function healthOn(date: string) {
  return allOf<HealthEntry>('health')
    .map((d) => d.data)
    .filter((h) => h.date === date);
}

export function healthBetween(from: string, to: string) {
  return allOf<HealthEntry>('health')
    .map((d) => d.data)
    .filter((h) => h.date >= from && h.date <= to);
}

export function healthLine(h: HealthEntry) {
  const parts: string[] = [];
  if (h.kcal) parts.push(`${h.kcal} kcal`);
  if (h.minutes) parts.push(h.minutes >= 60 ? `${Math.floor(h.minutes / 60)} h ${String(h.minutes % 60).padStart(2, '0')}` : `${h.minutes} min`);
  if (h.hrAvg) parts.push(`cœur ${h.hrAvg} bpm`);
  return parts.join(' · ');
}

export type Link = { token: string; createdAt: string };

export function getLink() {
  return getData<Link>('link');
}

export function linkUrl(token: string) {
  return `${SANTE_URL}?t=${token}`;
}

function randomToken() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

export async function createLink() {
  if (!supabase) throw new Error('pas de serveur');
  const old = getLink();
  if (old) await supabase.from('link_tokens').delete().eq('token', old.token);
  const token = randomToken();
  const { error } = await supabase.from('link_tokens').insert({ token });
  if (error) throw error;
  await putDoc<Link>('link', 'link', { token, createdAt: new Date().toISOString() });
  return token;
}

export function runShortcut() {
  location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent(SHORTCUT_NAME);
}
