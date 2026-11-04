// Envoie les notifications de repas à l'heure prévue par chaque utilisateur.
// Appelée chaque minute par pg_cron.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Meal = { name: string; time: string; share: { p: number; g: number; l: number } };
type Targets = { p: number; g: number; l: number; meals: Meal[] };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

let vapidReady = false;
async function setupVapid() {
  if (vapidReady) return;
  const { data, error } = await admin.from('app_secrets').select('name,value').in('name', ['vapid_public', 'vapid_private']);
  if (error) throw error;
  const get = (n: string) => data?.find((r) => r.name === n)?.value ?? '';
  webpush.setVapidDetails('https://alexrougeot.github.io/elan/', get('vapid_public'), get('vapid_private'));
  vapidReady = true;
}

function localParts(tz: string, d = new Date()) {
  const f = new Intl.DateTimeFormat('fr-FR', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: hour * 60 + Number(parts.minute) };
}

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function hhmm(t: string) {
  const [h, m] = t.split(':');
  return `${Number(h)}h${m}`;
}

Deno.serve(async () => {
  try {
    await setupVapid();
    const { data: subs, error } = await admin.from('push_subscriptions').select('endpoint,user_id,p256dh,auth,tz');
    if (error) throw error;
    if (!subs || subs.length === 0) return Response.json({ sent: 0 });

    const users = [...new Set(subs.map((s) => s.user_id))];
    const { data: docs, error: e2 } = await admin.from('docs').select('user_id,data').eq('id', 'targets').in('user_id', users);
    if (e2) throw e2;

    let sent = 0;
    for (const user of users) {
      const t = docs?.find((d) => d.user_id === user)?.data as Targets | undefined;
      if (!t?.meals?.length) continue;
      const userSubs = subs.filter((s) => s.user_id === user);
      const { date, minutes } = localParts(userSubs[0].tz || 'Europe/Paris');

      for (let i = 0; i < t.meals.length; i++) {
        const meal = t.meals[i];
        const at = toMinutes(meal.time);
        // fenêtre de 5 minutes au cas où un passage serait manqué
        if (minutes < at || minutes > at + 5) continue;
        const key = `${date}:repas:${i}`;
        const { data: inserted } = await admin
          .from('push_log')
          .upsert({ user_id: user, key }, { onConflict: 'user_id,key', ignoreDuplicates: true })
          .select('key');
        if (!inserted || inserted.length === 0) continue;

        const p = Math.round(t.p * meal.share.p);
        const g = Math.round(t.g * meal.share.g);
        const l = Math.round(t.l * meal.share.l);
        const kcal = Math.round(p * 4 + g * 4 + l * 9);
        const body = (i === 0 ? 'Pèse-toi à jeun, puis : ' : '') + `${kcal} kcal · P ${p} g · G ${g} g · L ${l} g`;
        const payload = JSON.stringify({ title: `${meal.name} · ${hhmm(meal.time)}`, body, tag: key, url: './?onglet=nutrition' });

        for (const s of userSubs) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 1800, urgency: 'high' });
            sent++;
          } catch (err) {
            const code = (err as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
            else console.error('envoi impossible', code, err);
          }
        }
      }
    }
    return Response.json({ sent });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
