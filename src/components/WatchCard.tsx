// Ce que la montre a enregistré pendant une séance de muscu : durée, calories, cœur, courbe avec les séries.
import { useState } from 'react';
import { getLink, healthForSession, openHae, type HealthEntry } from '../lib/health';
import { syncNow } from '../lib/sync';
import type { Session } from '../lib/coach';
import { useStoreVersion } from '../lib/store';
import { Icon, showToast } from './ui';

function fmtMin(m: number) {
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

/** Va chercher les données de la montre ; si rien n'est arrivé, propose d'ouvrir Health Auto Export */
export async function checkWatch(sessionId: string) {
  try {
    await syncNow();
  } catch {
    /* hors ligne : on regarde quand même ce qu'on a */
  }
  if (healthForSession(sessionId)) {
    showToast('Données de la montre ajoutées à ta séance');
    return true;
  }
  showToast('Pas encore reçu de ta montre', { label: 'Ouvrir Health Auto Export', run: openHae }, 6000);
  return false;
}

function HeartChart({ h, session }: { h: HealthEntry; session: Session }) {
  const hr = h.hr ?? [];
  if (hr.length < 3) return null;
  const W = 320;
  const H = 132;
  const L = 30;
  const R = 6;
  const T = 8;
  const B = 100;
  const total = Math.max(hr[hr.length - 1][0], h.start && h.end ? (new Date(h.end).getTime() - new Date(h.start).getTime()) / 1000 : 0, 60);
  const vals = hr.map((p) => p[1]);
  const lo = Math.floor((Math.min(...vals) - 5) / 10) * 10;
  const hi = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
  const x = (t: number) => L + (Math.max(0, Math.min(total, t)) / total) * (W - L - R);
  const y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T);
  const line = hr.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(hr[hr.length - 1][0]).toFixed(1)},${B} L${x(hr[0][0]).toFixed(1)},${B} Z`;
  const start = h.start ? new Date(h.start).getTime() : 0;
  const sets = start
    ? session.exercises.flatMap((e) => e.sets.filter((s) => s.done && s.at).map((s) => (new Date(s.at!).getTime() - start) / 1000)).filter((t) => t >= 0 && t <= total)
    : [];
  const mins = Math.round(total / 60);
  const ticks = [0, Math.round(mins / 2), mins];

  return (
    <div className="col" style={{ gap: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Ton cœur pendant la séance, de ${Math.min(...vals)} à ${Math.max(...vals)} battements par minute`}>
        <defs>
          <linearGradient id="hr-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[hi, Math.round((hi + lo) / 2), lo].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink3, var(--ink2))">
              {v}
            </text>
          </g>
        ))}
        {sets.map((t, i) => (
          <line key={i} x1={x(t)} x2={x(t)} y1={B + 4} y2={B + 13} stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
        ))}
        <path d={area} fill="url(#hr-fill)" />
        <path d={line} fill="none" stroke="var(--red)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {ticks.map((m, i) => (
          <text key={i} x={x(m * 60)} y={H - 2} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize="10" fill="var(--ink3, var(--ink2))">
            {m} min
          </text>
        ))}
      </svg>
      {sets.length > 0 && (
        <span className="tiny muted row" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: 'var(--brand)', display: 'inline-block' }} />
          Chaque trait vert, c’est une série validée dans Élan.
        </span>
      )}
    </div>
  );
}

export default function WatchCard({ sessionId, session }: { sessionId: string; session: Session }) {
  useStoreVersion();
  const [busy, setBusy] = useState(false);
  const h = healthForSession(sessionId);

  if (!h) {
    const recent = session.endedAt && Date.now() - new Date(session.endedAt).getTime() < 3 * 86400_000;
    if (!getLink() || !recent) return null;
    return (
      <div className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
        <span className="row small" style={{ gap: 8, fontWeight: 700 }}>
          <Icon name="heart" size={18} style={{ color: 'var(--red)' }} />
          Ta montre n’a pas encore envoyé cette séance
        </span>
        <span className="small muted" style={{ lineHeight: 1.45 }}>
          Health Auto Export l’envoie tout seul, mais l’iPhone le fait parfois attendre. Ouvre-le pour l’envoyer tout de suite, puis reviens ici.
        </span>
        <div className="col" style={{ gap: 8 }}>
          <button className="btn soft press" style={{ minHeight: 44 }} onClick={openHae}>
            Ouvrir Health Auto Export
          </button>
          <button
            className="btn ghost press"
            style={{ minHeight: 44 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await checkWatch(sessionId);
              setBusy(false);
            }}
          >
            {busy ? <span className="spinner" /> : 'Vérifier'}
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Durée', value: h.minutes ? fmtMin(h.minutes) : '–' },
    { label: 'Calories actives', value: h.kcal ? `${h.kcal} kcal` : '–' },
    { label: 'Cœur moyen', value: h.hrAvg ? `${h.hrAvg} bpm` : '–' },
    { label: 'Cœur max', value: h.hrMax ? `${h.hrMax} bpm` : '–' },
  ];

  return (
    <div className="card col" style={{ gap: 12, background: 'var(--card2)', boxShadow: 'none' }}>
      <span className="row small" style={{ gap: 8, fontWeight: 700 }}>
        <Icon name="heart" size={18} style={{ color: 'var(--red)', flex: 'none' }} />
        <span style={{ minWidth: 0 }}>
          {h.source}
          {h.name && <span className="muted" style={{ fontWeight: 500 }}> · {h.name}</span>}
        </span>
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {stats.map((s) => (
          <div key={s.label} className="col" style={{ gap: 1 }}>
            <span className="tiny muted">{s.label}</span>
            <span style={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>{s.value}</span>
          </div>
        ))}
      </div>
      <HeartChart h={h} session={session} />
    </div>
  );
}
