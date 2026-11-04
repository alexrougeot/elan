// Courses : récupérées dans Santé (Health Auto Export) avec le parcours, ou notées à la main.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { allOf, getData, getDoc, putDoc, useStoreVersion } from '../lib/store';
import { addDays, dayKey, longDate, shortDate } from '../lib/dates';
import { currentWeight, type Profile } from '../lib/nutrition';
import { activityKcal, chrono, deleteActivity, durationSec, fmtDuration, fuelBonus, paceSec, paceText, runs, type Activity } from '../lib/activity';
import { syncNow } from '../lib/sync';
import { useOnline } from '../lib/device';
import { Icon, Sheet, showToast } from '../components/ui';
import ActivitySheet, { bonusFood } from '../components/ActivitySheet';

// ---------- ouverture depuis n'importe quel écran ----------
type Open = { mode: 'run'; id: string } | { mode: 'fetch' } | null;
let opened: Open = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export function openRun(id: string) {
  opened = { mode: 'run', id };
  emit();
}
/** Bouton « Course » : on va chercher la sortie du jour dans Santé */
export function fetchRun() {
  opened = { mode: 'fetch' };
  emit();
}
function close() {
  opened = null;
  emit();
}
const useOpened = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => opened
  );

export function RunHost() {
  useStoreVersion();
  const o = useOpened();
  const [manual, setManual] = useState(false);
  return (
    <>
      <Sheet open={!!o} onClose={close} title={o?.mode === 'run' ? 'Course' : 'Ta course'} full>
        {o?.mode === 'run' && <RunView id={o.id} />}
        {o?.mode === 'fetch' && (
          <FetchView
            onManual={() => {
              close();
              setManual(true);
            }}
          />
        )}
      </Sheet>
      <ActivitySheet open={manual} onClose={() => setManual(false)} />
    </>
  );
}

/** Une course importée a un parcours ou une source montre */
const imported = (a: Activity) => !!a.source || !!a.route;
export const hasImport = () => allOf('activity').some((d) => d.id.startsWith('activity:hae-')) || allOf('health').some((d) => d.id.startsWith('health:hae-'));

function FetchView({ onManual }: { onManual: () => void }) {
  const online = useOnline();
  const [state, setState] = useState<'loading' | 'done'>('loading');
  const recent = runs().filter((r) => r.data.date >= addDays(dayKey(), -1) && imported(r.data));

  async function load() {
    setState('loading');
    try {
      await syncNow();
    } finally {
      setState('done');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  if (recent[0]) return <RunView id={recent[0].id} fresh />;
  if (state === 'loading')
    return (
      <div className="col" style={{ alignItems: 'center', gap: 12, padding: '40px 0' }}>
        <span className="spinner" aria-hidden />
        <span className="small muted">Je récupère ta course dans Santé…</span>
      </div>
    );

  return (
    <>
      <div className="card col" style={{ gap: 8, background: 'var(--sky-tint)', boxShadow: 'none', color: 'var(--sky-ink)' }}>
        <span className="row" style={{ gap: 8, fontWeight: 700 }}>
          <Icon name="run" size={20} />
          {hasImport() ? 'Pas encore de course aujourd’hui' : 'Branche Santé une fois pour toutes'}
        </span>
        <span className="small" style={{ lineHeight: 1.5 }}>
          {!online
            ? 'Tu es hors ligne : reconnecte-toi pour récupérer ta course.'
            : hasImport()
              ? 'Ta course arrive quelques minutes après la fin sur ta montre, quand ton iPhone est déverrouillé. Réessaie dans un instant.'
              : 'Pour que ta course arrive toute seule avec son parcours, installe Health Auto Export et suis les étapes dans Réglages › Montre et Santé.'}
        </span>
      </div>
      <button className="btn brand press" onClick={load} disabled={!online}>
        Réessayer
      </button>
      <button className="btn ghost press" onClick={onManual}>
        La noter à la main
      </button>
      <RunList />
    </>
  );
}

function RunList() {
  const list = runs().slice(0, 8);
  if (!list.length) return null;
  return (
    <>
      <div className="section-head">
        <h2 className="h2">Tes dernières courses</h2>
      </div>
      <div className="card tight">
        {list.map((r, i) => (
          <div key={r.id}>
            <button className="list-row press" onClick={() => openRun(r.id)}>
              <span className="tile sm tint-sky">
                <Icon name="run" size={18} />
              </span>
              <div className="grow col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600 }}>
                  {r.data.km?.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · {paceText(paceSec(r.data))}
                </span>
                <span className="small muted">
                  {shortDate(r.data.date)} · {fmtDuration(durationSec(r.data))}
                  {r.data.duo ? ' · à deux' : ''}
                </span>
              </div>
              <Icon name="right" style={{ color: 'var(--ink3)' }} />
            </button>
            {i < list.length - 1 && <div className="divider" />}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- fiche d'une course ----------
export function RunView({ id, fresh }: { id: string; fresh?: boolean }) {
  const doc = getDoc<Activity>(id);
  const profile = getData<Profile>('profile');
  const [confirm, setConfirm] = useState(false);
  if (!doc) return null;
  const a = doc.data;
  const dur = durationSec(a);
  const pace = paceSec(a);
  const kcal = activityKcal(a, currentWeight(profile) ?? profile?.weight);
  const bonus = a.date === dayKey() ? fuelBonus(kcal, profile?.goal) : 0;
  const hist = runs()
    .filter((r) => r.data.km && r.data.km >= 2)
    .slice(0, 10)
    .reverse();
  const before = hist.filter((r) => r.data.date < a.date);
  const avgBefore = before.length ? before.reduce((x, r) => x + paceSec(r.data), 0) / before.length : 0;
  const diff = avgBefore && pace ? pace - avgBefore : 0;

  const stat = (label: string, value: string, sub?: string) => (
    <div className="col" style={{ gap: 1, background: 'var(--card2)', borderRadius: 14, padding: '10px 12px' }}>
      <span className="tiny muted">{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      {sub && <span className="tiny muted">{sub}</span>}
    </div>
  );

  return (
    <>
      <div className="col" style={{ gap: 2 }}>
        {fresh && (
          <span className="row small" style={{ gap: 6, color: 'var(--brand-ink)', fontWeight: 700 }}>
            <Icon name="check" size={16} stroke={2.6} />
            Récupérée depuis Santé
          </span>
        )}
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{longDate(a.date)}</span>
        <span className="small muted">
          {a.startedAt ? new Date(a.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h') + ' · ' : ''}
          {a.source ?? 'Notée à la main'}
          {a.duo ? ' · à deux' : ''}
        </span>
      </div>

      {a.route && a.route.length > 1 ? (
        <RouteMap route={a.route} />
      ) : (
        <div className="card row small muted" style={{ background: 'var(--card2)', boxShadow: 'none', gap: 8 }}>
          <Icon name="info" size={18} />
          Pas de parcours pour cette course : il arrive avec les courses récupérées depuis Santé.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {stat('Distance', `${(a.km ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km`)}
        {stat('Durée', chrono(dur))}
        {stat('Allure', paceText(pace).replace(' /km', ''), diff ? `${diff < 0 ? '−' : '+'}${Math.round(Math.abs(diff))} s vs d’hab.` : '/km')}
        {stat('Cœur moyen', a.hrAvg ? `${a.hrAvg}` : '–', a.hrMax ? `max ${a.hrMax} bpm` : 'bpm')}
        {stat('Calories', `${kcal}`, a.kcal ? 'kcal (montre)' : 'kcal (estimées)')}
        {stat('Dénivelé', a.elev !== undefined ? `${a.elev} m` : '–', 'positif')}
      </div>

      {a.kmSplits && a.kmSplits.length > 0 && <Splits splits={a.kmSplits} />}

      {hist.length >= 2 && <PaceTrend list={hist.map((r) => ({ id: r.id, date: r.data.date, pace: paceSec(r.data) }))} current={id} />}

      {bonus > 0 && (
        <div className="card small" style={{ color: 'var(--orange-ink)', background: 'var(--orange-tint)', boxShadow: 'none', lineHeight: 1.5 }}>
          Élan a ajouté {bonus} kcal à ton objectif du jour pour ne pas freiner ta prise de masse. Par exemple : {bonusFood(bonus)}.
        </div>
      )}

      <div className="segmented" role="group" aria-label="Seul ou à deux">
        <button aria-pressed={!a.duo} onClick={() => void putDoc(id, 'activity', { ...a, duo: false })}>
          Seul
        </button>
        <button aria-pressed={!!a.duo} onClick={() => void putDoc(id, 'activity', { ...a, duo: true })}>
          À deux
        </button>
      </div>

      {!confirm ? (
        <button className="btn ghost press" onClick={() => setConfirm(true)}>
          Supprimer cette course
        </button>
      ) : (
        <button
          className="btn danger press"
          onClick={async () => {
            await deleteActivity(id);
            close();
            showToast('Course supprimée');
          }}
        >
          Oui, supprimer
        </button>
      )}
    </>
  );
}

// ---------- carte du parcours, colorée selon l'allure ----------
export function RouteMap({ route, height = 230 }: { route: number[][]; height?: number }) {
  const W = 340;
  const H = height;
  const pad = 18;
  const lat0 = route.reduce((s, p) => s + p[0], 0) / route.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k);
  const ys = route.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min((W - pad * 2) / (maxX - minX || 1e-6), (H - pad * 2) / (maxY - minY || 1e-6));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const P = route.map((_, i) => [ox + (xs[i] - minX) * scale, oy + (ys[i] - minY) * scale]);

  // allure de chaque tronçon, normalisée entre le 10e et le 90e centile
  const dist = (a: number[], b: number[]) => {
    const R = 6371000;
    const r = Math.PI / 180;
    const dLat = (b[0] - a[0]) * r;
    const dLon = (b[1] - a[1]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  // vitesse lissée sur quelques points, sinon le GPS fait des rayures
  const raw = route.slice(1).map((p, i) => [dist(route[i], p), p[2] - route[i][2]]);
  const speeds = raw.map((_, i) => {
    let d = 0;
    let t = 0;
    for (let j = Math.max(0, i - 4); j <= Math.min(raw.length - 1, i + 4); j++) {
      d += raw[j][0];
      t += raw[j][1];
    }
    return t > 0 ? d / t : NaN;
  });
  const ok = speeds.filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  const lo = ok[Math.floor(ok.length * 0.1)] ?? 0;
  const hi = ok[Math.floor(ok.length * 0.9)] ?? 1;
  const color = (s: number) => {
    if (!Number.isFinite(s) || hi <= lo) return '#10B981';
    const t = Math.max(0, Math.min(1, (s - lo) / (hi - lo)));
    // orange (lent) → émeraude → citron (rapide)
    const stops = [
      [249, 115, 22],
      [16, 185, 129],
      [132, 204, 22],
    ];
    const seg = t < 0.5 ? 0 : 1;
    const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const c = stops[seg].map((v, j) => Math.round(v + (stops[seg + 1][j] - v) * u));
    return `rgb(${c.join(',')})`;
  };

  // repères de kilomètre
  const marks: { x: number; y: number; n: number }[] = [];
  let acc = 0;
  let next = 1000;
  for (let i = 1; i < route.length; i++) {
    acc += dist(route[i - 1], route[i]);
    if (acc >= next) {
      marks.push({ x: P[i][0], y: P[i][1], n: next / 1000 });
      next += 1000;
    }
  }
  const all = P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  const totalKm = acc / 1000;

  return (
    <div className="route-card">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Parcours de ${totalKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kilomètres`} style={{ display: 'block' }}>
        <defs>
          <pattern id="route-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" style={{ fill: 'none', stroke: 'var(--line2)', strokeWidth: 1 }} />
          </pattern>
        </defs>
        <rect width={W} height={H} style={{ fill: 'url(#route-grid)' }} />
        <polyline points={all} style={{ fill: 'none', stroke: 'var(--card)', strokeWidth: 9, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
        {P.slice(1).map((p, i) => (
          <line key={i} x1={P[i][0]} y1={P[i][1]} x2={p[0]} y2={p[1]} style={{ stroke: color(speeds[i]), strokeWidth: 4.5, strokeLinecap: 'round' }} />
        ))}
        {marks.map((m) => (
          <g key={m.n}>
            <circle cx={m.x} cy={m.y} r={8} style={{ fill: 'var(--card)', stroke: 'var(--ink)', strokeWidth: 1.5 }} />
            <text x={m.x} y={m.y + 3.2} style={{ fontSize: 9, fontWeight: 700, fill: 'var(--ink)', textAnchor: 'middle' }}>
              {m.n}
            </text>
          </g>
        ))}
        <circle cx={P[0][0]} cy={P[0][1]} r={7} style={{ fill: '#10B981', stroke: '#fff', strokeWidth: 2.5 }} />
        <circle cx={P[P.length - 1][0]} cy={P[P.length - 1][1]} r={7} style={{ fill: '#0F172A', stroke: '#fff', strokeWidth: 2.5 }} />
      </svg>
      <div className="row between tiny muted" style={{ padding: '0 14px 12px' }}>
        <span className="row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: '#10B981', boxShadow: '0 0 0 2px #fff' }} /> Départ
          <span style={{ width: 10, height: 10, borderRadius: 5, background: '#0F172A', boxShadow: '0 0 0 2px #fff', marginLeft: 8 }} /> Arrivée
        </span>
        <span className="row" style={{ gap: 6 }}>
          Lent
          <span style={{ width: 54, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #F97316, #10B981, #84CC16)' }} />
          Rapide
        </span>
      </div>
    </div>
  );
}

function Splits({ splits }: { splits: number[] }) {
  const best = Math.min(...splits);
  const worst = Math.max(...splits);
  return (
    <section className="card col" style={{ gap: 8 }}>
      <div className="col" style={{ gap: 1 }}>
        <span style={{ fontWeight: 700 }}>Allure par kilomètre</span>
        <span className="tiny muted">Barre longue = kilomètre rapide. En vert clair, ton meilleur.</span>
      </div>
      {splits.map((s, i) => {
        const w = worst === best ? 1 : 0.45 + (0.55 * (worst - s)) / (worst - best);
        return (
          <div key={i} className="row small" style={{ gap: 10 }}>
            <span className="muted" style={{ width: 34, fontVariantNumeric: 'tabular-nums' }}>
              km {i + 1}
            </span>
            <span className="grow" style={{ height: 22, background: 'var(--line2)', borderRadius: 7, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${w * 100}%`, borderRadius: 7, background: s === best ? 'var(--lime)' : 'var(--brand)' }} />
            </span>
            <span style={{ width: 44, textAlign: 'right', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{paceText(s).replace(' /km', '')}</span>
          </div>
        );
      })}
    </section>
  );
}

/** Allure des dernières courses (plus haut = plus rapide) */
export function PaceTrend({ list, current, tall }: { list: { id: string; date: string; pace: number }[]; current?: string; tall?: boolean }) {
  const W = 340;
  const H = tall ? 170 : 110;
  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 20;
  const ps = list.map((l) => l.pace);
  const min = Math.min(...ps) - 10;
  const max = Math.max(...ps) + 10;
  const x = (i: number) => padL + (list.length === 1 ? 0.5 : i / (list.length - 1)) * (W - padL - padR);
  const y = (p: number) => padT + ((p - min) / (max - min || 1)) * (H - padT - padB);
  const pts = list.map((l, i) => `${x(i).toFixed(1)},${y(l.pace).toFixed(1)}`).join(' ');
  const first = list[0].pace;
  const last = list[list.length - 1].pace;
  const delta = last - first;
  const ticks = [min + 10, (min + max) / 2, max - 10];
  return (
    <section className="card col" style={{ gap: 8 }}>
      <div className="row between">
        <span style={{ fontWeight: 700 }}>Ta progression</span>
        <span className="small" style={{ fontWeight: 650, color: delta <= 0 ? 'var(--brand-ink)' : 'var(--amber-ink)' }}>
          {delta <= 0 ? '−' : '+'}
          {Math.round(Math.abs(delta))} s/km en {list.length} courses
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Allure moyenne des dernières courses" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="pace-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--line2)', strokeWidth: 1 }} />
            <text x={padL - 6} y={y(t) + 3.5} style={{ fontSize: 10, fill: 'var(--ink2)', textAnchor: 'end' }}>
              {paceText(t).replace(' /km', '')}
            </text>
          </g>
        ))}
        {list.length > 1 && <polygon points={`${x(0)},${H - padB} ${pts} ${x(list.length - 1)},${H - padB}`} style={{ fill: 'url(#pace-area)' }} />}
        <polyline points={pts} style={{ fill: 'none', stroke: 'var(--brand-ink)', strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
        {list.map((l, i) => (
          <circle key={l.id} cx={x(i)} cy={y(l.pace)} r={l.id === current ? 6 : 3.5} style={{ fill: l.id === current ? 'var(--lime)' : 'var(--brand)', stroke: 'var(--card)', strokeWidth: 2 }} />
        ))}
        {list.map((l, i) =>
          i === 0 || i === list.length - 1 ? (
            <text key={'d' + l.id} x={x(i)} y={H - 4} style={{ fontSize: 10, fill: 'var(--ink2)', textAnchor: i === 0 ? 'start' : 'end' }}>
              {shortDate(l.date)}
            </text>
          ) : null
        )}
      </svg>
      <span className="tiny muted">Allure moyenne de chaque course de 2 km ou plus. Plus haut = plus rapide.</span>
    </section>
  );
}
