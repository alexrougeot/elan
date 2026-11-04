// Reçoit les données de la montre.
// 1. Raccourci iPhone « Élan montre » :
//    GET  ?t=LIEN            → { minutes } : combien de minutes lire dans Santé
//    POST { t, kcal, fcMoy, fcMax, source } → enregistre l'activité dans Élan
// 2. App Health Auto Export (automatisation API REST, format JSON) :
//    POST ?t=LIEN { data: { workouts: [...] } } → courses avec parcours, séances, etc.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });

/** « 412,5 kcal » → 412.5 ; accepte aussi les listes renvoyées par Raccourcis */
function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) return num(v[0]);
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = String(v).replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return s ? Number(s[0]) : undefined;
}

function parisDate(d = new Date()) {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}


// ---------------- Health Auto Export ----------------
type Qty = { qty?: number; units?: string } | number | undefined;
type HaeWorkout = Record<string, any>;

const qty = (v: Qty) => (typeof v === 'number' ? v : num((v as { qty?: number })?.qty));
const unitsOf = (v: Qty) => (typeof v === 'object' && v ? String(v.units ?? '').toLowerCase() : '');

/** « 2026-11-07 09:12:44 +0100 » → Date */
function haeDate(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*([+-]\d{2}):?(\d{2})?$/);
  const d = m ? new Date(`${m[1]}T${m[2]}${m[3]}:${m[4] ?? '00'}`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function km(v: Qty) {
  const q = qty(v);
  if (q === undefined) return undefined;
  const u = unitsOf(v);
  if (u === 'm') return q / 1000;
  if (u === 'mi') return q * 1.609344;
  if (u === 'yd') return q * 0.0009144;
  return q;
}

function kcalOf(v: Qty) {
  const q = qty(v);
  if (q === undefined) return undefined;
  return unitsOf(v) === 'kj' ? q / 4.184 : q;
}

function kindOf(name: string): 'course' | 'marche' | 'velo' | 'natation' | 'muscu' | 'cardio' | 'autre' {
  const n = name.toLowerCase();
  if (/run|course|jogging|footing/.test(n)) return 'course';
  if (/walk|marche|hik|randonn/.test(n)) return 'marche';
  if (/cycl|bike|vélo|velo/.test(n)) return 'velo';
  if (/swim|natation|nage/.test(n)) return 'natation';
  // « Entraînement de force fonctionnel », HIIT, cross training… : séances type Hyrox
  if (/hiit|interval|fraction|cross|crois|functional|fonctionnel|mixed|mixte|row|rameur|elliptic|ski|cardio|kickbox|boxe/.test(n)) return 'cardio';
  // « Entraînement de force traditionnel », renforcement musculaire… : séances de muscu
  if (/strength|force|renfo|musculation|weight|haltéro|core|gainage/.test(n)) return 'muscu';
  return 'autre';
}

function haversine(a: number[], b: number[]) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Parcours simplifié [lat, lon, secondes depuis le départ, altitude] et temps de chaque km */
function routeOf(w: HaeWorkout, start: Date) {
  const raw: unknown[] = Array.isArray(w.route) ? w.route : Array.isArray(w.route?.locations) ? w.route.locations : [];
  const pts: number[][] = [];
  for (const p of raw as Record<string, unknown>[]) {
    const lat = num(p.lat ?? p.latitude);
    const lon = num(p.lon ?? p.lng ?? p.longitude);
    if (lat === undefined || lon === undefined) continue;
    const t = haeDate(p.timestamp ?? p.date ?? p.time);
    const alt = num(p.altitude ?? p.elevation);
    pts.push([lat, lon, t ? Math.max(0, (t.getTime() - start.getTime()) / 1000) : NaN, alt ?? NaN]);
  }
  if (pts.length < 2) return { route: undefined, splits: undefined, gain: undefined, dist: undefined };
  // temps par km, sur le parcours complet
  const splits: number[] = [];
  let dist = 0;
  let next = 1000;
  let lastT = 0;
  let gain = 0;
  let ref = NaN; // dénivelé : on ignore les petites variations du GPS (moins de 3 m)
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1], pts[i]);
    const alt = pts[i][3];
    if (!Number.isNaN(alt)) {
      if (Number.isNaN(ref)) ref = alt;
      else if (alt > ref + 3) {
        gain += alt - ref;
        ref = alt;
      } else if (alt < ref - 3) ref = alt;
    }
    const before = dist;
    dist += d;
    while (dist >= next && !Number.isNaN(pts[i][2])) {
      const f = d > 0 ? (next - before) / d : 1;
      const t = pts[i - 1][2] + f * (pts[i][2] - pts[i - 1][2]);
      splits.push(Math.round(t - lastT));
      lastT = t;
      next += 1000;
    }
  }
  const step = Math.max(1, Math.ceil(pts.length / 400));
  const route = pts
    .filter((_, i) => i % step === 0 || i === pts.length - 1)
    .map(([a, b, t, h]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5, Number.isNaN(t) ? 0 : Math.round(t), Number.isNaN(h) ? 0 : Math.round(h)]);
  return { route, splits: splits.length ? splits : undefined, gain: Math.round(gain), dist: dist / 1000 };
}

function heartOf(w: HaeWorkout) {
  let avg = qty(w.avgHeartRate) ?? qty(w.heartRate?.avg) ?? qty(w.averageHeartRate);
  let max = qty(w.maxHeartRate) ?? qty(w.heartRate?.max);
  const series: Record<string, unknown>[] = Array.isArray(w.heartRateData) ? w.heartRateData : [];
  if (series.length && (avg === undefined || max === undefined)) {
    const vals = series.map((p) => num(p.Avg ?? p.avg ?? p.qty)).filter((x): x is number => x !== undefined);
    const maxes = series.map((p) => num(p.Max ?? p.max ?? p.qty)).filter((x): x is number => x !== undefined);
    if (avg === undefined && vals.length) avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (max === undefined && maxes.length) max = Math.max(...maxes);
  }
  return { avg: avg !== undefined ? Math.round(avg) : undefined, max: max !== undefined ? Math.round(max) : undefined };
}

/** Nom de l'appareil : la source peut être un texte, un objet ou une liste */
function sourceOf(w: HaeWorkout): string {
  const pickName = (v: unknown): string | undefined => {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return pickName(v[0]);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return pickName(o.name ?? o.sourceName ?? o.deviceName ?? o.productType ?? o.device);
    }
    return undefined;
  };
  const raw = pickName(w.source) ?? pickName(w.sourceName) ?? pickName(w.device) ?? 'Montre';
  const s = raw.trim();
  if (/watch/i.test(s)) return 'Apple Watch';
  if (/garmin|forerunner|fenix|venu|instinct|epix/i.test(s)) return 'Garmin';
  return s.slice(0, 40) || 'Montre';
}

async function importWorkouts(userId: string, workouts: HaeWorkout[]) {
  let imported = 0;
  const lines: string[] = [];
  for (const w of workouts) {
    const start = haeDate(w.start ?? w.startDate);
    if (!start) continue;
    const end = haeDate(w.end ?? w.endDate) ?? new Date(start.getTime() + (num(w.duration) ?? 0) * 1000);
    const name = String(w.name ?? w.workoutActivityType ?? 'Entraînement');
    const kind = kindOf(name);
    const minutes = Math.max(1, Math.round((num(w.duration) ?? (end.getTime() - start.getTime()) / 1000) / 60));
    const kcal = kcalOf(w.activeEnergyBurned ?? w.activeEnergy ?? w.totalEnergy);
    const heart = heartOf(w);
    const { route, splits, gain, dist } = routeOf(w, start);
    const distance = km(w.distance) ?? dist;
    const elev = qty(w.elevationUp) ?? num(w.elevation?.ascent) ?? gain;
    const source = sourceOf(w);
    const date = parisDate(start);
    const now = new Date().toISOString();
    const extId = String(w.id ?? `${start.getTime()}-${name}`).replace(/[^\w-]/g, '').slice(0, 60);

    if (kind === 'muscu' || kind === 'cardio') {
      // on rattache à la séance Élan qui chevauche cet entraînement
      const from = new Date(start.getTime() - 45 * 60000).toISOString();
      const { data: near } = await admin
        .from('docs')
        .select('id,kind,data')
        .eq('user_id', userId)
        .in('kind', ['session', 'activity'])
        .eq('deleted', false)
        .gte('data->>startedAt', from)
        .lte('data->>startedAt', end.toISOString())
        .order('data->>startedAt', { ascending: false })
        .limit(5);
      type Doc = { id: string; kind: string; data: Record<string, unknown> };
      const list = (near ?? []) as Doc[];
      const session = list.find((d) => d.kind === 'session');
      const circuit = list.find((d) => d.kind === 'activity' && ['hyrox', 'circuit'].includes(String(d.data.type)));
      const match = kind === 'cardio' ? circuit ?? session : session ?? circuit;
      if (match?.kind === 'activity') {
        const data = { ...match.data, kcal: kcal !== undefined ? Math.round(kcal) : match.data.kcal, hrAvg: heart.avg, hrMax: heart.max, source };
        await admin.from('docs').upsert({ user_id: userId, id: match.id, kind: 'activity', data, updated_at: now, deleted: false }, { onConflict: 'user_id,id' });
        imported++;
        lines.push(`${name} rattaché`);
        continue;
      }
      const id = match ? 'health:' + match.id.replace('session:', '') : `health:hae-${extId}`;
      const data = {
        date,
        sessionId: match?.id ?? null,
        title: (match?.data.title as string | undefined) ?? null,
        kcal: kcal !== undefined ? Math.round(kcal) : null,
        hrAvg: heart.avg ?? null,
        hrMax: heart.max ?? null,
        minutes,
        source,
        at: now,
      };
      await admin.from('docs').upsert({ user_id: userId, id, kind: 'health', data, updated_at: now, deleted: false }, { onConflict: 'user_id,id' });
      imported++;
      lines.push(`${name} : ${data.kcal ?? '?'} kcal`);
      continue;
    }

    // course, marche, vélo, natation… : une activité Élan complète
    const id = `activity:hae-${extId}`;
    const { data: existing } = await admin.from('docs').select('deleted,data').eq('user_id', userId).eq('id', id).maybeSingle();
    if (existing?.deleted) continue; // supprimée dans l'app : on ne la ressuscite pas
    const type = kind === 'autre' ? 'autre' : kind;
    const data = {
      // on garde ce que l'utilisateur a ajouté dans l'app (ressenti, à deux…)
      ...((existing?.data as Record<string, unknown> | undefined) ?? {}),
      date,
      type,
      minutes,
      km: distance !== undefined ? Math.round(distance * 100) / 100 : undefined,
      kcal: kcal !== undefined ? Math.round(kcal) : undefined,
      hrAvg: heart.avg,
      hrMax: heart.max,
      elev: elev !== undefined ? Math.round(elev) : undefined,
      route,
      kmSplits: splits,
      source,
      name,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      at: now,
    };
    const { error } = await admin.from('docs').upsert({ user_id: userId, id, kind: 'activity', data, updated_at: now, deleted: false }, { onConflict: 'user_id,id' });
    if (error) throw error;
    imported++;
    lines.push(`${name} : ${data.km ?? '?'} km`);
  }
  return { imported, lines };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      const text = await req.text();
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = Object.fromEntries(new URLSearchParams(text));
      }
    }
    const token = String(url.searchParams.get('t') ?? body.t ?? body.token ?? '').trim();
    if (!token) return json({ ok: false, message: 'Lien manquant' }, 401);

    const { data: link } = await admin.from('link_tokens').select('user_id').eq('token', token).maybeSingle();
    if (!link) return json({ ok: false, message: 'Lien inconnu : recrée-le dans les réglages d’Élan.' }, 401);
    const userId = link.user_id as string;

    // Health Auto Export : une liste d'entraînements
    const dataObj = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : undefined;
    const workouts = dataObj?.workouts ?? body.workouts;
    console.log(
      'reçu',
      JSON.stringify({
        method: req.method,
        ua: (req.headers.get('user-agent') ?? '').slice(0, 60),
        keys: Object.keys(body).slice(0, 12),
        dataKeys: dataObj ? Object.keys(dataObj) : null,
        workouts: Array.isArray(workouts) ? workouts.length : null,
        names: Array.isArray(workouts) ? (workouts as HaeWorkout[]).slice(0, 8).map((w) => `${w?.name} ${String(w?.start ?? '').slice(0, 10)}`) : null,
        first: Array.isArray(workouts) && workouts[0] ? Object.keys(workouts[0] as object).join(',') : null,
        source: Array.isArray(workouts) && workouts[0] ? JSON.stringify((workouts[0] as HaeWorkout).source ?? null).slice(0, 160) : null,
        vals: dataObj ? null : Object.fromEntries(Object.entries(body).filter(([k]) => k !== 't' && k !== 'token').map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 24) : typeof v === 'number' ? v : typeof v])),
      })
    );
    if (req.method === 'POST' && Array.isArray(workouts)) {
      const { imported, lines } = await importWorkouts(userId, workouts as HaeWorkout[]);
      return json({ ok: true, imported, message: imported ? `Élan : ${lines.join(', ')}` : 'Élan : aucun entraînement dans cette période.' });
    }
    if (req.method === 'POST' && dataObj) {
      return json({ ok: false, message: 'Élan attend des entraînements : dans Health Auto Export, choisis le type de données Workouts.' }, 422);
    }

    // Séance Élan des 8 dernières heures, s'il y en a une
    const since = new Date(Date.now() - 8 * 3600_000).toISOString();
    const { data: sessions } = await admin
      .from('docs')
      .select('id,data')
      .eq('user_id', userId)
      .eq('kind', 'session')
      .eq('deleted', false)
      .gte('data->>startedAt', since)
      .order('data->>startedAt', { ascending: false })
      .limit(1);
    const session = sessions?.[0] as { id: string; data: { startedAt: string; endedAt?: string; title?: string } } | undefined;
    const start = session ? new Date(session.data.startedAt) : null;
    const end = session?.data.endedAt ? new Date(session.data.endedAt) : new Date();
    const sessionMinutes = start ? Math.round((end.getTime() - start.getTime()) / 60000) : undefined;
    const minutes = Math.max(15, Math.min(240, (sessionMinutes ?? 85) + 5));

    if (req.method === 'GET') return json({ ok: true, minutes, seance: session?.data.title ?? null });

    // champs du raccourci, sans tenir compte des majuscules, espaces et accents
    const flat = (k: string) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const fields = Object.fromEntries(Object.entries(body).map(([k, v]) => [flat(k), v]));
    const pick = (...names: string[]) => num(names.map((n) => fields[n]).find((v) => v !== undefined && v !== ''));
    const kcal = pick('kcal', 'calories', 'energie', 'energieactive', 'somme');
    const hrAvg = pick('fcmoy', 'fcmoyenne', 'hravg', 'moyenne', 'coeur');
    const hrMax = pick('fcmax', 'hrmax', 'maximum');
    const dur = pick('duree', 'minutes') ?? sessionMinutes ?? minutes - 5;
    if (kcal === undefined && hrAvg === undefined) {
      const recu = Object.keys(body).filter((k) => k !== 't' && k !== 'token');
      return json(
        {
          ok: false,
          message: recu.length
            ? `Élan a reçu ${recu.join(', ')} mais sans valeur. Vérifie que Raccourcis a le droit de lire Santé (Réglages › Santé › Accès aux données).`
            : 'Élan n’a reçu aucune donnée : vérifie le corps de la requête (JSON) dans la dernière action du raccourci.',
        },
        400
      );
    }

    const now = new Date();
    const id = session ? 'health:' + session.id.replace('session:', '') : `health:${parisDate(now)}:${now.getTime()}`;
    const data = {
      date: parisDate(start ?? now),
      sessionId: session?.id ?? null,
      title: session?.data.title ?? null,
      kcal: kcal !== undefined ? Math.round(kcal) : null,
      hrAvg: hrAvg !== undefined ? Math.round(hrAvg) : null,
      hrMax: hrMax !== undefined ? Math.round(hrMax) : null,
      minutes: Math.round(dur),
      source: String(body.source ?? 'Santé').slice(0, 40),
      at: now.toISOString(),
    };
    const { error } = await admin
      .from('docs')
      .upsert({ user_id: userId, id, kind: 'health', data, updated_at: now.toISOString(), deleted: false }, { onConflict: 'user_id,id' });
    if (error) throw error;

    const parts = [data.kcal !== null ? `${data.kcal} kcal` : null, data.hrAvg !== null ? `cœur moyen ${data.hrAvg}` : null].filter(Boolean);
    return json({ ok: true, message: `Élan : ${parts.join(' · ')} enregistrés${session ? ' pour ' + (session.data.title ?? 'ta séance') : ''}.` });
  } catch (e) {
    console.error(e);
    return json({ ok: false, message: 'Erreur du serveur Élan.' }, 500);
  }
});
