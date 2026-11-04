export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number) {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** 1 = lundi … 7 = dimanche */
export function weekday(d = new Date()) {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

export const WEEKDAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function longDate(key: string) {
  const s = parseDay(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortDate(key: string) {
  return parseDay(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function monthYear(d: Date) {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Lundi de la semaine du jour donné */
export function weekStart(key: string) {
  const d = parseDay(key);
  return addDays(key, -(weekday(d) - 1));
}

export function hhmm(t: string) {
  const [h, m] = t.split(':');
  return `${Number(h)}h${m}`;
}

export function minutesOf(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtKg(n: number, digits = 1) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtNum(n: number) {
  return Math.round(n).toLocaleString('fr-FR');
}

export function fmtWeight(n: number) {
  // 62.5 → « 62,5 », 60 → « 60 »
  return Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}
