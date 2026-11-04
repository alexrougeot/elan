import { useMemo, useState } from 'react';
import { allOf, getData, putDoc, useStoreVersion } from '../lib/store';
import { addDays, dayKey, daysBetween, fmtKg, monthYear, parseDay, shortDate, weekStart } from '../lib/dates';
import { avg7, currentWeight, eta, getTargets, targetRate, undoAdjustment, weekAvg, weighIns, type Profile } from '../lib/nutrition';
import { e1rm, sessions } from '../lib/coach';
import { CATALOG, exName } from '../lib/program';
import { compressImage, haptic } from '../lib/device';
import { HeroLeaves, Icon, Sheet, showToast } from '../components/ui';
import WeighInSheet from '../components/WeighIn';
import WeeklyReview from '../components/WeeklyReview';

type Measure = { date: string; waist?: number; hips?: number; chest?: number; arm?: number; thigh?: number; photo?: string };
const MEASURES: { key: keyof Measure; label: string }[] = [
  { key: 'waist', label: 'Tour de taille' },
  { key: 'hips', label: 'Hanches' },
  { key: 'chest', label: 'Poitrine' },
  { key: 'arm', label: 'Bras' },
  { key: 'thigh', label: 'Cuisse' },
];

export default function Progress() {
  useStoreVersion();
  const [tab, setTab] = useState<'poids' | 'force' | 'corps'>('poids');
  const [review, setReview] = useState(false);

  return (
    <main className="screen">
      <header className="screen-head">
        <h1 className="title">Progrès</h1>
        <button className="btn small ghost press" onClick={() => setReview(true)}>
          <Icon name="flag" size={18} />
          Bilan
        </button>
      </header>
      <div className="segmented" role="group" aria-label="Vue">
        <button aria-pressed={tab === 'poids'} onClick={() => setTab('poids')}>
          Poids
        </button>
        <button aria-pressed={tab === 'force'} onClick={() => setTab('force')}>
          Force
        </button>
        <button aria-pressed={tab === 'corps'} onClick={() => setTab('corps')}>
          Corps
        </button>
      </div>
      {tab === 'poids' && <WeightView />}
      {tab === 'force' && <StrengthView />}
      {tab === 'corps' && <BodyView />}
      <WeeklyReview open={review} onClose={() => setReview(false)} />
    </main>
  );
}

// ---------------- Poids ----------------
function WeightView() {
  const profile = getData<Profile>('profile')!;
  const targets = getTargets();
  const list = weighIns();
  const current = currentWeight(profile) ?? profile.weight;
  const [weigh, setWeigh] = useState(false);

  // Rythme réel sur les 3 dernières semaines (si assez de pesées)
  const today = dayKey();
  const a = avg7(today, list);
  const b = avg7(addDays(today, -21), list);
  const realRate = a !== undefined && b !== undefined && list.length >= 10 ? (a - b) / 3 : undefined;
  const rate = targetRate(profile.goal);
  const toGo = profile.goalWeight - current;
  const usedRate = realRate !== undefined && Math.sign(realRate) === Math.sign(toGo) && Math.abs(realRate) > 0.05 ? Math.abs(realRate) : rate;
  const arrival = profile.goal !== 'maintien' ? eta(current, profile.goalWeight, usedRate) : null;
  const progress = profile.goalWeight !== profile.weight ? Math.max(0, Math.min(1, (current - profile.weight) / (profile.goalWeight - profile.weight))) : 0;

  const weeks = useMemo(() => {
    const out: { monday: string; avg?: number }[] = [];
    let m = weekStart(today);
    for (let i = 0; i < 8; i++) {
      out.push({ monday: m, avg: weekAvg(m, list) });
      m = addDays(m, -7);
    }
    return out.filter((w) => w.avg !== undefined);
  }, [list.length, today]);

  return (
    <>
      {profile.goal !== 'maintien' && (
        <section className="hero col" style={{ gap: 10 }}>
          <HeroLeaves />
          <span className="hero-chip" style={{ alignSelf: 'flex-start' }}>
            <Icon name="flag" size={15} />
            Objectif {profile.goal === 'masse' ? 'prise de masse' : 'sèche'}
          </span>
          <div className="row" style={{ gap: 10, alignItems: 'baseline' }}>
            <span className="big-num">{fmtKg(current)} kg</span>
            <Icon name="right" size={18} style={{ color: 'rgba(255,255,255,0.7)' }} />
            <span className="big-num" style={{ color: '#BEF264' }}>
              {fmtKg(profile.goalWeight, profile.goalWeight % 1 ? 1 : 0)} kg
            </span>
          </div>
          <div className="bar" style={{ height: 8, background: 'rgba(255,255,255,0.18)' }}>
            <div style={{ width: Math.max(3, progress * 100) + '%', background: '#BEF264' }} />
          </div>
          <div className="row between small">
            <span className="on-hero-2">Encore {fmtKg(Math.abs(toGo))} kg</span>
            {arrival && <span style={{ fontWeight: 600 }}>Arrivée estimée : {monthYear(arrival)}</span>}
          </div>
          <span className="tiny on-hero-2">
            {realRate !== undefined
              ? `Ton rythme actuel : ${realRate.toLocaleString('fr-FR', { maximumFractionDigits: 2, signDisplay: 'always' })} kg par semaine.`
              : `Au rythme visé de ${rate.toLocaleString('fr-FR')} kg par semaine. Ton vrai rythme s’affichera après quelques semaines de pesées.`}
          </span>
        </section>
      )}

      <section className="card col" style={{ gap: 10 }}>
        <div className="row between">
          <h2 className="h2">Ta courbe</h2>
          <button className="btn small soft press" onClick={() => setWeigh(true)}>
            <Icon name="scale" size={18} />
            Me peser
          </button>
        </div>
        <WeightChart profile={profile} arrival={arrival} />
        <div className="row tiny muted" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 5 }}>
            <span className="sync-dot" style={{ background: 'var(--brand)', opacity: 0.45 }} />
            Pesées
          </span>
          <span className="row" style={{ gap: 5 }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--brand-ink)' }} />
            Moyenne 7 jours
          </span>
          {profile.goal !== 'maintien' && (
            <span className="row" style={{ gap: 5 }}>
              <span style={{ width: 14, borderTop: '2px dashed var(--lime)' }} />
              Projection
            </span>
          )}
        </div>
      </section>

      {weeks.length > 0 && (
        <section className="card tight">
          {weeks.map((w, i) => {
            const prev = weeks[i + 1]?.avg;
            const d = prev !== undefined && w.avg !== undefined ? w.avg - prev : undefined;
            return (
              <div key={w.monday}>
                <div className="list-row">
                  <span className="grow small" style={{ fontWeight: 600 }}>
                    Semaine du {shortDate(w.monday)}
                  </span>
                  <span className="small">{fmtKg(w.avg!)} kg</span>
                  <span className="small" style={{ width: 64, textAlign: 'right', color: d === undefined ? 'var(--ink3)' : 'var(--ink2)' }}>
                    {d === undefined ? '' : d.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'always' })}
                  </span>
                </div>
                {i < weeks.length - 1 && <div className="divider" />}
              </div>
            );
          })}
        </section>
      )}

      {targets && targets.history.length > 0 && (
        <section className="card col" style={{ gap: 8 }}>
          <h2 className="h2">Ajustements des calories</h2>
          {[...targets.history].reverse().slice(0, 6).map((h, ri) => {
            const idx = targets.history.length - 1 - ri;
            return (
              <div key={idx} className="row" style={{ alignItems: 'flex-start' }}>
                <span className="badge" style={{ opacity: h.undone ? 0.5 : 1 }}>
                  {h.delta > 0 ? '+' : ''}
                  {h.delta} kcal
                </span>
                <span className="grow small" style={{ textDecoration: h.undone ? 'line-through' : undefined, color: h.undone ? 'var(--ink3)' : undefined }}>
                  {shortDate(h.date)} · {h.reason}
                </span>
                {!h.undone && ri === 0 && (
                  <button className="chip press" onClick={() => undoAdjustment(idx)}>
                    Annuler
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <WeighInSheet open={weigh} onClose={() => setWeigh(false)} />
    </>
  );
}

function WeightChart({ profile, arrival }: { profile: Profile; arrival: Date | null }) {
  const list = weighIns();
  const W = 340;
  const H = 170;
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const today = dayKey();
  const first = list[0]?.date ?? today;
  const endKey = arrival ? dayKey(arrival) : addDays(today, 30);
  const lastKey = endKey > addDays(today, 14) ? endKey : addDays(today, 14);
  const span = Math.max(14, daysBetween(first, lastKey));
  const values = [...list.map((x) => x.kg), profile.goal !== 'maintien' ? profile.goalWeight : profile.weight, profile.weight];
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const x = (k: string) => padL + (daysBetween(first, k) / span) * (W - padL - padR);
  const y = (kg: number) => padT + (1 - (kg - min) / (max - min)) * (H - padT - padB);

  const avgPts = list.map((w) => `${x(w.date).toFixed(1)},${y(avg7(w.date, list)!).toFixed(1)}`).join(' ');
  const cur = currentWeight(profile) ?? profile.weight;
  const ticks = [min, Math.round((min + max) / 2), max];
  const months: { k: string; label: string }[] = [];
  const d = parseDay(first);
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  while (dayKey(d) <= lastKey) {
    months.push({ k: dayKey(d), label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') });
    d.setMonth(d.getMonth() + (span > 200 ? 2 : 1));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Courbe de poids, actuellement ${fmtKg(cur)} kilos`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="elan-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--line2)', strokeWidth: 1 }} />
          <text x={padL - 6} y={y(t) + 3.5} style={{ fontSize: 10, fill: 'var(--ink2)', textAnchor: 'end' }}>
            {t}
          </text>
        </g>
      ))}
      {months.map((m) => (
        <text key={m.k} x={x(m.k)} y={H - 6} style={{ fontSize: 10, fill: 'var(--ink2)', textAnchor: 'middle' }}>
          {m.label}
        </text>
      ))}
      {profile.goal !== 'maintien' && (
        <>
          <line x1={padL} x2={W - padR} y1={y(profile.goalWeight)} y2={y(profile.goalWeight)} style={{ stroke: 'var(--lime)', strokeWidth: 1.5, strokeDasharray: '3 4' }} />
          {arrival && (
            <line x1={x(today)} y1={y(cur)} x2={x(dayKey(arrival))} y2={y(profile.goalWeight)} style={{ stroke: 'var(--lime)', strokeWidth: 2.5, strokeDasharray: '5 6', strokeLinecap: 'round' }} />
          )}
        </>
      )}
      {list.map((w) => (
        <circle key={w.date} cx={x(w.date)} cy={y(w.kg)} r={2.6} style={{ fill: 'var(--brand)', opacity: 0.45 }} />
      ))}
      {list.length > 1 && (
        <polygon
          points={`${x(list[0].date).toFixed(1)},${(H - padB).toFixed(1)} ${avgPts} ${x(list[list.length - 1].date).toFixed(1)},${(H - padB).toFixed(1)}`}
          style={{ fill: 'url(#elan-area)', stroke: 'none' }}
        />
      )}
      {list.length > 1 && <polyline points={avgPts} style={{ fill: 'none', stroke: 'var(--brand-ink)', strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }} />}
      <circle cx={x(today)} cy={y(cur)} r={5} style={{ fill: 'var(--brand)', stroke: 'var(--card)', strokeWidth: 2 }} />
    </svg>
  );
}

// ---------------- Force ----------------
function StrengthView() {
  const all = sessions().filter((s) => s.data.endedAt);
  const byKey = new Map<string, { date: string; v: number; w: number; r: number }[]>();
  for (const s of [...all].reverse()) {
    for (const e of s.data.exercises) {
      if (CATALOG[e.key]?.timed) continue;
      let best: { v: number; w: number; r: number } | null = null;
      for (const x of e.sets) if (x.done && x.w > 0) {
        const v = e1rm(x.w, x.r);
        if (!best || v > best.v) best = { v, w: x.w, r: x.r };
      }
      if (best) byKey.set(e.key, [...(byKey.get(e.key) ?? []), { date: s.data.date, ...best }]);
    }
  }
  const main = ['squat', 'bench', 'deadlift', 'ohp', 'row', 'rdl', 'hip_thrust'];
  const keys = [...byKey.keys()].sort((a, b) => {
    const ia = main.indexOf(a);
    const ib = main.indexOf(b);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return (byKey.get(b)!.length ?? 0) - (byKey.get(a)!.length ?? 0);
  });

  if (keys.length === 0)
    return (
      <div className="card empty">
        Tes max estimés apparaîtront après ta première séance. Pas besoin de tester ton max : Élan le calcule à partir de tes séries.
      </div>
    );

  return (
    <>
      <p className="small muted" style={{ margin: '0 4px' }}>
        Max estimé = charge × (1 + reps ÷ 30), calculé sur ta meilleure série, sans faire de vrai max.
      </p>
      {keys.map((k) => {
        const pts = byKey.get(k)!;
        const best = pts.reduce((a, b) => (b.v > a.v ? b : a));
        const last = pts[pts.length - 1];
        const firstV = pts[0].v;
        return (
          <section key={k} className="card col" style={{ gap: 8 }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div className="col" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 17 }}>{exName(k)}</span>
                <span className="tiny muted">
                  Record : {best.w} kg × {best.r} ({shortDate(best.date)})
                </span>
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 20 }}>{Math.round(last.v)} kg</span>
                {pts.length > 1 && (
                  <span className="tiny" style={{ fontWeight: 600, color: last.v >= firstV ? 'var(--brand-ink)' : 'var(--amber-ink)' }}>
                    {last.v >= firstV ? '+' : ''}
                    {Math.round(last.v - firstV)} kg depuis le début
                  </span>
                )}
              </div>
            </div>
            {pts.length > 1 && <Spark values={pts.map((p) => p.v)} />}
          </section>
        );
      })}
    </>
  );
}

function Spark({ values }: { values: number[] }) {
  const W = 320;
  const H = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (W - 8) + 4).toFixed(1)},${(H - 4 - ((v - min) / (max - min || 1)) * (H - 8)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
      <polyline points={pts} style={{ fill: 'none', stroke: 'var(--brand)', strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
    </svg>
  );
}

// ---------------- Corps : mensurations et photos ----------------
function BodyView() {
  const list = allOf<Measure>('measure')
    .map((d) => d.data)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const [open, setOpen] = useState(false);
  const last = list[0];
  const firstM = list[list.length - 1];
  const due = !last || daysBetween(last.date, dayKey()) >= 28;
  const photos = list.filter((m) => m.photo);

  return (
    <>
      <button className="card press row" style={{ border: 'none', textAlign: 'left', background: due ? 'var(--brand-tint)' : undefined }} onClick={() => setOpen(true)}>
        <span className="tile tint-violet">
          <Icon name="ruler" />
        </span>
        <div className="grow col" style={{ gap: 2 }}>
          <span style={{ fontWeight: 700, color: due ? 'var(--brand-deep)' : undefined }}>{due ? 'C’est le moment de tes mesures du mois' : 'Ajouter des mesures'}</span>
          <span className="small" style={{ color: due ? 'var(--brand-deep)' : 'var(--ink2)' }}>
            {last ? `Dernières mesures le ${shortDate(last.date)}.` : 'Tour de taille, bras, cuisse… et une photo, une fois par mois.'}
          </span>
        </div>
        <Icon name="right" style={{ color: 'var(--ink3)' }} />
      </button>

      {last && (
        <section className="card tight">
          {MEASURES.map((m, i) => {
            const v = last[m.key] as number | undefined;
            const f = firstM !== last ? (firstM[m.key] as number | undefined) : undefined;
            if (v === undefined) return null;
            return (
              <div key={m.key}>
                <div className="list-row">
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {m.label}
                  </span>
                  <span>{v.toLocaleString('fr-FR')} cm</span>
                  <span className="small muted" style={{ width: 64, textAlign: 'right' }}>
                    {f !== undefined ? (v - f).toLocaleString('fr-FR', { maximumFractionDigits: 1, signDisplay: 'always' }) : ''}
                  </span>
                </div>
                {i < MEASURES.length - 1 && <div className="divider" />}
              </div>
            );
          })}
        </section>
      )}

      {photos.length > 0 && (
        <section className="card col" style={{ gap: 10 }}>
          <h2 className="h2">Photos</h2>
          <div className="photo-grid">
            {photos.map((p) => (
              <figure key={p.date} style={{ margin: 0 }}>
                <img src={p.photo} alt={`Photo du ${shortDate(p.date)}`} />
                <figcaption className="tiny muted" style={{ marginTop: 4, textAlign: 'center' }}>
                  {shortDate(p.date)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <MeasureSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function MeasureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = dayKey();
  const existing = getData<Measure>('measure:' + today);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      setPhoto(await compressImage(f));
    } catch {
      showToast('Impossible de lire cette photo.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    haptic();
    const m: Measure = { ...existing, date: today };
    for (const k of MEASURES) {
      const v = vals[k.key as string];
      if (v !== undefined && v !== '') (m as any)[k.key] = Number(v.replace(',', '.'));
    }
    if (photo) m.photo = photo;
    await putDoc('measure:' + today, 'measure', m);
    showToast('Mesures enregistrées');
    setVals({});
    setPhoto(undefined);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Mesures du mois" full>
      <p className="small muted" style={{ margin: 0 }}>
        Mesure le matin, au même endroit à chaque fois, avec un mètre ruban souple. Tout est facultatif.
      </p>
      <div className="fields-2">
        {MEASURES.map((m) => (
          <label key={m.key} className="field">
            <span>{m.label} (cm)</span>
            <input
              inputMode="decimal"
              placeholder={existing?.[m.key] !== undefined ? String(existing[m.key]) : ''}
              value={vals[m.key as string] ?? ''}
              onChange={(e) => setVals((v) => ({ ...v, [m.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="col" style={{ gap: 8 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Photo (reste privée, sur ton compte)
        </span>
        {photo && <img src={photo} alt="Aperçu de la photo" style={{ width: 140, borderRadius: 12 }} />}
        <label className="btn ghost press" style={{ position: 'relative' }}>
          <Icon name="camera" size={18} />
          {busy ? 'Préparation…' : photo ? 'Changer la photo' : 'Prendre ou choisir une photo'}
          <input type="file" accept="image/*" onChange={pick} style={{ position: 'absolute', inset: 0, opacity: 0, minHeight: 0 }} aria-label="Photo" />
        </label>
      </div>
      <button className="btn brand press" onClick={save}>
        Enregistrer
      </button>
    </Sheet>
  );
}
