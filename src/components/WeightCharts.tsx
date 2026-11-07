// Poids : la carte de l'accueil et la vraie courbe jour par jour (semaine, mois, année).
import { useMemo, useState } from 'react';
import { getData } from '../lib/store';
import { addDays, dayKey, daysBetween, fmtKg, parseDay, shortDate, weekStart } from '../lib/dates';
import { avg7, weighIns, type Profile } from '../lib/nutrition';
import { HeroLeaves, Icon } from './ui';

type W = { date: string; kg: number };

const signed = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' });

/** Couleur d'une variation : vert quand on va dans le sens de l'objectif */
function deltaColor(d: number, goal?: Profile['goal']) {
  if (Math.abs(d) < 0.05 || !goal || goal === 'maintien') return 'var(--ink2)';
  return (goal === 'seche' ? d < 0 : d > 0) ? 'var(--brand-ink)' : 'var(--amber-ink)';
}

function dayLabel(key: string, today = dayKey()) {
  if (key === today) return 'aujourd’hui';
  if (key === addDays(today, -1)) return 'hier';
  return 'le ' + shortDate(key);
}

// ---------------- Accueil : le poids en grand ----------------
export function WeightHero({ onWeigh, onOpen }: { onWeigh: () => void; onOpen: () => void }) {
  const profile = getData<Profile>('profile')!;
  const list = weighIns();
  const today = dayKey();
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const weighedToday = last?.date === today;
  const avg = avg7(today, list);
  const delta = last && prev ? last.kg - prev.kg : undefined;
  const record = list.length ? Math.max(...list.map((w) => w.kg)) : undefined;
  const isRecord = profile.goal === 'masse' && last && record !== undefined && list.length > 1 && last.kg >= record && last.date === today;
  const start = profile.weight;
  const goal = profile.goalWeight;
  const cur = avg ?? last?.kg ?? start;
  const progress = goal !== start ? Math.max(0, Math.min(1, (cur - start) / (goal - start))) : 0;
  const recent = list.filter((w) => w.date >= addDays(today, -13));

  return (
    <section className="hero col" style={{ gap: 12 }}>
      <HeroLeaves />
      <div className="row between">
        <span className="hero-chip">
          <Icon name="scale" size={15} />
          {weighedToday ? 'Poids du jour' : last ? `Dernière pesée ${dayLabel(last.date)}` : 'Ton poids'}
        </span>
        {isRecord && (
          <span className="hero-chip" style={{ background: '#BEF264', color: '#14532D' }}>
            <Icon name="trophy" size={15} />
            Record
          </span>
        )}
      </div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
        <span className="big-num" style={{ fontSize: 46, lineHeight: 1 }}>{last ? fmtKg(last.kg) : '—'}</span>
        <span style={{ fontSize: 20, fontWeight: 700, paddingBottom: 4 }}>kg</span>
        <span className="grow" />
        {delta !== undefined && (
          <span className="col" style={{ alignItems: 'flex-end', gap: 1, paddingBottom: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: Math.abs(delta) < 0.05 ? '#fff' : (profile.goal === 'seche' ? delta < 0 : delta > 0) ? '#BEF264' : '#FCD34D' }}>{signed(delta)} kg</span>
            <span className="tiny on-hero-2">depuis {dayLabel(prev!.date)}</span>
          </span>
        )}
      </div>
      {recent.length >= 2 && <MiniLine list={recent} from={addDays(today, -13)} to={today} />}
      {profile.goal !== 'maintien' && (
        <div className="col" style={{ gap: 6 }}>
          <div className="bar" style={{ height: 8, background: 'rgba(255,255,255,0.18)' }}>
            <div style={{ width: Math.max(3, progress * 100) + '%', background: '#BEF264' }} />
          </div>
          <div className="row between small">
            <span className="on-hero-2">{avg !== undefined ? `Moyenne 7 jours : ${fmtKg(avg)} kg` : 'Pèse-toi chaque matin'}</span>
            <span style={{ fontWeight: 600 }}>Objectif {fmtKg(goal, goal % 1 ? 1 : 0)} kg</span>
          </div>
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        {!weighedToday && (
          <button className="btn press grow" style={{ background: '#fff', color: 'var(--brand-deep)', minHeight: 46 }} onClick={onWeigh}>
            <Icon name="scale" size={19} />
            Me peser
          </button>
        )}
        <button className="btn press grow" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', minHeight: 46 }} onClick={onOpen}>
          {weighedToday ? 'Voir ma courbe' : 'Courbe'}
          <Icon name="right" size={18} />
        </button>
      </div>
    </section>
  );
}

function MiniLine({ list, from, to }: { list: W[]; from: string; to: string }) {
  const W = 320;
  const H = 64;
  const span = Math.max(1, daysBetween(from, to));
  const vals = list.map((w) => w.kg);
  const lo = Math.min(...vals) - 0.2;
  const hi = Math.max(...vals) + 0.2;
  const x = (k: string) => 6 + (daysBetween(from, k) / span) * (W - 12);
  const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo || 1)) * (H - 16);
  const pts = list.map((w) => `${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  const last = list[list.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} style={{ fill: 'none', stroke: 'rgba(255,255,255,0.75)', strokeWidth: 2.2, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
      {list.map((w) => (
        <circle key={w.date} cx={x(w.date)} cy={y(w.kg)} r={w === last ? 4.5 : 2.4} style={{ fill: w === last ? '#BEF264' : '#fff', opacity: w === last ? 1 : 0.85 }} />
      ))}
    </svg>
  );
}

// ---------------- Progrès : la courbe par période ----------------
type Period = 'semaine' | 'mois' | 'annee';
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function range(period: Period, offset: number, today: string) {
  if (period === 'semaine') {
    const from = addDays(weekStart(today), offset * 7);
    return { from, to: addDays(from, 6), title: offset === 0 ? 'Cette semaine' : offset === -1 ? 'La semaine dernière' : `Semaine du ${shortDate(from)}` };
  }
  const d = parseDay(today);
  if (period === 'mois') {
    const first = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const name = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return { from: dayKey(first), to: dayKey(last), title: name.charAt(0).toUpperCase() + name.slice(1) };
  }
  const y = d.getFullYear() + offset;
  return { from: `${y}-01-01`, to: `${y}-12-31`, title: String(y) };
}

export function WeightPeriods() {
  const profile = getData<Profile>('profile')!;
  const all = weighIns();
  const today = dayKey();
  const [period, setPeriod] = useState<Period>('semaine');
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const r = range(period, offset, today);
  const list = useMemo(() => all.filter((w) => w.date >= r.from && w.date <= r.to), [all.length, r.from, r.to]);
  const earliest = all[0]?.date ?? today;
  const canBack = earliest < r.from;
  const canNext = offset < 0;

  function change(p: Period) {
    setPeriod(p);
    setOffset(0);
    setSel(null);
  }
  function move(n: number) {
    setOffset((o) => o + n);
    setSel(null);
  }

  const first = list[0];
  const last = list[list.length - 1];
  const prevOf = (date: string) => [...all].reverse().find((w) => w.date < date);
  const shown = (sel ? list.find((w) => w.date === sel) : undefined) ?? last;
  const shownPrev = shown ? prevOf(shown.date) : undefined;
  const hi = list.length ? list.reduce((a, b) => (b.kg > a.kg ? b : a)) : undefined;
  const lo = list.length ? list.reduce((a, b) => (b.kg < a.kg ? b : a)) : undefined;
  const mean = list.length ? list.reduce((a, b) => a + b.kg, 0) / list.length : undefined;
  const before = first ? prevOf(first.date) : undefined;
  const change1 = first && last ? last.kg - (before?.kg ?? first.kg) : undefined;

  return (
    <section className="card col" style={{ gap: 12 }}>
      <div className="segmented" role="group" aria-label="Période">
        {(['semaine', 'mois', 'annee'] as Period[]).map((p) => (
          <button key={p} aria-pressed={period === p} onClick={() => change(p)}>
            {p === 'semaine' ? 'Semaine' : p === 'mois' ? 'Mois' : 'Année'}
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className="icon-btn press" aria-label="Période précédente" onClick={() => move(-1)} disabled={!canBack} style={{ opacity: canBack ? 1 : 0.35 }}>
          <Icon name="left" />
        </button>
        <div className="grow col" style={{ alignItems: 'center', gap: 1 }}>
          <span style={{ fontWeight: 700 }}>{r.title}</span>
          <span className="tiny muted">
            {list.length ? `${list.length} pesée${list.length > 1 ? 's' : ''}` : 'Aucune pesée'}
            {change1 !== undefined && list.length > 0 ? ` · ${signed(change1)} kg` : ''}
          </span>
        </div>
        <button className="icon-btn press" aria-label="Période suivante" onClick={() => move(1)} disabled={!canNext} style={{ opacity: canNext ? 1 : 0.35 }}>
          <Icon name="right" />
        </button>
      </div>

      {shown && (
        <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtKg(shown.kg)} kg</span>
          {shownPrev && (
            <span className="small" style={{ fontWeight: 650, color: deltaColor(shown.kg - shownPrev.kg, profile.goal) }}>
              {signed(shown.kg - shownPrev.kg)}
            </span>
          )}
          <span className="grow" />
          <span className="small muted">{parseDay(shown.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
      )}

      {list.length > 0 ? (
        <PeriodChart period={period} from={r.from} to={r.to} list={list} all={all} sel={shown?.date ?? null} onSel={setSel} goal={profile.goal} />
      ) : (
        <div className="empty small" style={{ padding: '28px 8px' }}>
          Pas de pesée sur cette période.
        </div>
      )}

      {list.length > 1 && hi && lo && mean !== undefined && (
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            ['Plus haut', fmtKg(hi.kg), shortDate(hi.date)],
            ['Plus bas', fmtKg(lo.kg), shortDate(lo.date)],
            ['Moyenne', fmtKg(mean), `${list.length} pesées`],
          ].map(([l, v, s]) => (
            <div key={l} className="col" style={{ gap: 1, background: 'var(--card2)', borderRadius: 14, padding: '10px 12px' }}>
              <span className="tiny muted">{l}</span>
              <span style={{ fontWeight: 700, fontSize: 17 }}>{v} kg</span>
              <span className="tiny muted">{s}</span>
            </div>
          ))}
        </div>
      )}

      <Breakdown period={period} from={r.from} to={r.to} list={list} all={all} goal={profile.goal} />
    </section>
  );
}

function niceTicks(lo: number, hi: number) {
  const span = hi - lo;
  const step = span <= 1.2 ? 0.5 : span <= 3 ? 1 : span <= 6 ? 2 : 5;
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
}

function PeriodChart({ period, from, to, list, all, sel, onSel, goal }: { period: Period; from: string; to: string; list: W[]; all: W[]; sel: string | null; onSel: (d: string) => void; goal: Profile['goal'] }) {
  const W = 340;
  const H = 190;
  const L = 34;
  const R = 10;
  const T = period === 'semaine' ? 22 : 12;
  const B = 24;
  const span = Math.max(1, daysBetween(from, to));
  const vals = list.map((w) => w.kg);
  const ticks = niceTicks(Math.min(...vals) - 0.2, Math.max(...vals) + 0.2);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const inset = period === 'semaine' ? 18 : 8;
  const x = (k: string) => L + inset + (daysBetween(from, k) / span) * (W - L - R - inset * 2);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const line = list.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  // moyenne sur 7 jours (mois, année)
  const avgLine =
    period !== 'semaine' && list.length > 2
      ? list.map((w, i) => `${i ? 'L' : 'M'}${x(w.date).toFixed(1)},${y(avg7(w.date, all)!).toFixed(1)}`).join(' ')
      : '';
  const labels: { k: string; t: string }[] = [];
  if (period === 'semaine') for (let i = 0; i < 7; i++) labels.push({ k: addDays(from, i), t: 'LMMJVSD'[i] });
  else if (period === 'mois') for (const d of [1, 8, 15, 22, 29]) labels.push({ k: from.slice(0, 8) + String(d).padStart(2, '0'), t: String(d) });
  else for (let m = 0; m < 12; m++) labels.push({ k: `${from.slice(0, 4)}-${String(m + 1).padStart(2, '0')}-01`, t: MONTHS[m].charAt(0).toUpperCase() });
  const big = period === 'semaine';
  const r = period === 'annee' ? 1.8 : big ? 4.5 : 3.2;

  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = list[0];
    for (const w of list) if (Math.abs(x(w.date) - px) < Math.abs(x(best.date) - px)) best = w;
    if (best && best.date !== sel) onSel(best.date);
  }

  const selW = list.find((w) => w.date === sel);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Courbe de poids, de ${fmtKg(Math.min(...vals))} à ${fmtKg(Math.max(...vals))} kilos`}
      style={{ display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
      onPointerDown={pick}
      onPointerMove={(e) => {
        if (e.buttons || e.pointerType !== 'mouse') pick(e);
      }}
    >
      <defs>
        <linearGradient id="w-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--line2)', strokeWidth: 1 }} />
          <text x={L - 6} y={y(t) + 3.5} style={{ fontSize: 10, fill: 'var(--ink2)', textAnchor: 'end' }}>
            {t.toLocaleString('fr-FR')}
          </text>
        </g>
      ))}
      {labels.map((l) => (
        <text key={l.k} x={x(l.k)} y={H - 6} style={{ fontSize: 10, fill: l.k === dayKey() ? 'var(--brand-ink)' : 'var(--ink2)', fontWeight: l.k === dayKey() ? 700 : 400, textAnchor: 'middle' }}>
          {l.t}
        </text>
      ))}
      {selW && <line x1={x(selW.date)} x2={x(selW.date)} y1={T - 6} y2={H - B} style={{ stroke: 'var(--brand)', strokeWidth: 1, opacity: 0.35 }} />}
      {list.length > 1 && <path d={`${line} L${x(list[list.length - 1].date).toFixed(1)},${H - B} L${x(list[0].date).toFixed(1)},${H - B} Z`} fill="url(#w-area)" />}
      {list.length > 1 && (
        <path d={line} style={{ fill: 'none', stroke: avgLine ? 'var(--brand)' : 'var(--brand-ink)', strokeWidth: avgLine ? 1.4 : 2.6, opacity: avgLine ? 0.5 : 1, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
      )}
      {avgLine && <path d={avgLine} style={{ fill: 'none', stroke: 'var(--brand-ink)', strokeWidth: 2.6, strokeLinejoin: 'round', strokeLinecap: 'round' }} />}
      {list.map((w) => (
        <circle key={w.date} cx={x(w.date)} cy={y(w.kg)} r={w.date === sel ? r + 2 : r} style={{ fill: w.date === sel ? 'var(--brand-ink)' : 'var(--brand)', stroke: 'var(--card)', strokeWidth: big || w.date === sel ? 2 : 0 }} />
      ))}
      {big &&
        list.map((w, i) => {
          const p = list[i - 1];
          return (
            <text key={'t' + w.date} x={x(w.date)} y={y(w.kg) - 10} style={{ fontSize: 10.5, fontWeight: 650, textAnchor: 'middle', fill: p ? deltaColor(w.kg - p.kg, goal) : 'var(--ink)' }}>
              {fmtKg(w.kg)}
            </text>
          );
        })}
    </svg>
  );
}

/** Le détail sous la courbe : jours (semaine), semaines (mois), mois (année) */
function Breakdown({ period, from, to, list, all, goal }: { period: Period; from: string; to: string; list: W[]; all: W[]; goal: Profile['goal'] }) {
  type Row = { key: string; label: string; kg?: number; delta?: number; sub?: string };
  const rows: Row[] = [];
  const mean = (l: W[]) => (l.length ? l.reduce((a, b) => a + b.kg, 0) / l.length : undefined);

  if (period === 'semaine') {
    for (let i = 0; i < 7; i++) {
      const k = addDays(from, i);
      const w = list.find((x) => x.date === k);
      const p = [...all].reverse().find((x) => x.date < k);
      rows.push({ key: k, label: parseDay(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }), kg: w?.kg, delta: w && p ? w.kg - p.kg : undefined });
    }
  } else if (period === 'mois') {
    let m = weekStart(from);
    while (m <= to) {
      const end = addDays(m, 6);
      const l = all.filter((x) => x.date >= m && x.date <= end);
      const pl = all.filter((x) => x.date >= addDays(m, -7) && x.date < m);
      const a = mean(l);
      const b = mean(pl);
      if (m <= dayKey()) rows.push({ key: m, label: `Semaine du ${shortDate(m)}`, kg: a, delta: a !== undefined && b !== undefined ? a - b : undefined, sub: l.length ? `${l.length} pesée${l.length > 1 ? 's' : ''}` : undefined });
      m = addDays(m, 7);
    }
  } else {
    const y = Number(from.slice(0, 4));
    for (let i = 0; i < 12; i++) {
      const a0 = `${y}-${String(i + 1).padStart(2, '0')}-01`;
      if (a0 > dayKey()) break;
      const l = all.filter((x) => x.date.startsWith(a0.slice(0, 7)));
      const prevKey = i === 0 ? `${y - 1}-12` : `${y}-${String(i).padStart(2, '0')}`;
      const pl = all.filter((x) => x.date.startsWith(prevKey));
      const a = mean(l);
      const b = mean(pl);
      if (l.length) rows.push({ key: a0, label: MONTHS[i].charAt(0).toUpperCase() + MONTHS[i].slice(1).replace('.', ''), kg: a, delta: a !== undefined && b !== undefined ? a - b : undefined, sub: `moyenne de ${l.length} pesée${l.length > 1 ? 's' : ''}` });
    }
  }
  if (!rows.some((r) => r.kg !== undefined)) return null;
  const shown = period === 'semaine' ? rows : [...rows].reverse();

  return (
    <div className="col" style={{ gap: 0 }}>
      <span className="small muted" style={{ fontWeight: 600, marginBottom: 4 }}>
        {period === 'semaine' ? 'Jour par jour' : period === 'mois' ? 'Semaine par semaine' : 'Mois par mois'}
      </span>
      {shown.map((r, i) => (
        <div key={r.key}>
          <div className="list-row" style={{ minHeight: 44, padding: '8px 0' }}>
            <span className="grow col" style={{ gap: 0 }}>
              <span className="small" style={{ fontWeight: 600, textTransform: period === 'semaine' ? 'capitalize' : undefined, color: r.kg === undefined ? 'var(--ink3)' : undefined }}>
                {r.label}
              </span>
              {r.sub && <span className="tiny muted">{r.sub}</span>}
            </span>
            <span className="small" style={{ fontWeight: 650, color: r.kg === undefined ? 'var(--ink3)' : undefined }}>{r.kg !== undefined ? `${fmtKg(r.kg)} kg` : '—'}</span>
            <span className="small" style={{ width: 58, textAlign: 'right', fontWeight: 600, color: r.delta === undefined ? 'var(--ink3)' : deltaColor(r.delta, goal) }}>
              {r.delta !== undefined ? signed(r.delta) : ''}
            </span>
          </div>
          {i < shown.length - 1 && <div className="divider" />}
        </div>
      ))}
    </div>
  );
}
