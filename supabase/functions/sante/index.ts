// Reçoit les données de la montre envoyées par le raccourci iPhone « Élan montre ».
// GET  ?t=LIEN            → { minutes } : combien de minutes lire dans Santé
// POST { t, kcal, fcMoy, fcMax, source } → enregistre l'activité dans Élan
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

    const kcal = num(body.kcal ?? body.calories ?? body.energie);
    const hrAvg = num(body.fcMoy ?? body.fcmoy ?? body.hrAvg);
    const hrMax = num(body.fcMax ?? body.fcmax ?? body.hrMax);
    const dur = num(body.duree ?? body.minutes) ?? sessionMinutes ?? minutes - 5;
    if (kcal === undefined && hrAvg === undefined) return json({ ok: false, message: 'Aucune donnée reçue de Santé.' }, 400);

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
