// Séances type Hyrox : choix du format, chrono, fin.
import { useEffect, useRef, useState } from 'react';
import { getData, getDoc, putDoc, removeDoc } from '../lib/store';
import { dayKey, shortDate } from '../lib/dates';
import type { Profile } from '../lib/nutrition';
import { activities, chrono, circuitScore, saveActivity, type Activity } from '../lib/activity';
import { circuitFor, FORMATS, itemText, qtyText, weekIndex, type CircuitFormat, type CircuitPlan } from '../lib/conditioning';
import { haptic, keepScreenOn, tone, unlockAudio } from '../lib/device';
import { HeroLeaves, Icon, Sheet, Stepper, showToast, useNow } from '../components/ui';

const ORDER: CircuitFormat[] = ['enchainement', 'emom', 'amrap'];
const PHASES = ['Cette semaine : on démarre un nouveau cycle.', 'Cette semaine : un peu plus de volume.', 'Cette semaine : la plus dure du cycle.', 'Cette semaine : plus légère, pour récupérer.'];

function lastOf(format: CircuitFormat) {
  return activities().find((a) => a.data.type === 'circuit' && a.data.plan?.format === format);
}

function PlanList({ plan, compact }: { plan: CircuitPlan; compact?: boolean }) {
  const items = plan.format === 'enchainement' ? plan.items.filter((i) => !i.run) : plan.items;
  const run = plan.items.find((i) => i.run);
  return (
    <div className="col" style={{ gap: compact ? 6 : 10 }}>
      {plan.format === 'enchainement' && run && (
        <span className="small" style={{ fontWeight: 600, color: 'var(--sky-ink)' }}>
          Avant chaque station : {qtyText(run)} de course
        </span>
      )}
      {items.map((i, n) => (
        <div key={n} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
          <span className={'tile sm ' + (i.run ? 'tint-sky' : 'tint-orange')} style={{ fontWeight: 700, fontSize: 13, width: 28, height: 28, borderRadius: 9 }}>
            {i.run ? <Icon name="run" size={15} /> : n + 1 - (plan.format === 'amrap' && plan.items[0].run ? 1 : 0)}
          </span>
          <div className="grow col" style={{ gap: 1, paddingTop: 3 }}>
            <span className="small" style={{ fontWeight: 650 }}>
              {i.unit === 'reps' ? `${i.qty} ${i.name.toLowerCase()}` : `${i.name} · ${qtyText(i)}`}
              {i.load ? <span className="muted" style={{ fontWeight: 500 }}> · {i.load}</span> : null}
            </span>
            {!compact && i.alt && <span className="tiny muted">{i.alt}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CircuitStartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = getData<Profile>('profile');
  const [format, setFormat] = useState<CircuitFormat>('enchainement');
  const [duo, setDuo] = useState(false);
  const week = weekIndex();
  const plans = Object.fromEntries(ORDER.map((f) => [f, circuitFor(f, week, profile?.sex, duo)])) as Record<CircuitFormat, CircuitPlan>;
  const plan = plans[format];
  const last = lastOf(format);

  async function go() {
    unlockAudio();
    haptic();
    tone('go');
    await saveActivity({ date: dayKey(), type: 'circuit', minutes: 0, duo, plan, splits: [], missed: [], rounds: 0, startedAt: new Date().toISOString() });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Séance type Hyrox">
      <p className="small muted" style={{ margin: 0 }}>
        Trois formats au choix. Le contenu change chaque lundi. {PHASES[((week % 4) + 4) % 4]}
      </p>
      <div className="col" style={{ gap: 8 }} role="radiogroup" aria-label="Format">
        {ORDER.map((f) => {
          const p = plans[f];
          const on = f === format;
          return (
            <button
              key={f}
              role="radio"
              aria-checked={on}
              className="card press col"
              onClick={() => setFormat(f)}
              style={{ gap: 4, textAlign: 'left', border: on ? '2px solid var(--brand)' : '2px solid transparent', background: on ? 'var(--brand-tint)' : 'var(--card)', boxShadow: on ? 'none' : undefined, padding: '12px 14px' }}
            >
              <span className="row between">
                <span style={{ fontWeight: 700, fontSize: 17, color: on ? 'var(--brand-deep)' : undefined }}>{FORMATS[f].name}</span>
                <span className="badge gray">{f === 'enchainement' ? `≈ ${p.minutes} min` : `${p.minutes} min`}</span>
              </span>
              <span className="small" style={{ color: on ? 'var(--brand-deep)' : 'var(--ink2)' }}>
                {FORMATS[f].short}
              </span>
            </button>
          );
        })}
      </div>

      <div className="segmented" role="group" aria-label="Seul ou à deux">
        <button aria-pressed={!duo} onClick={() => setDuo(false)}>
          Seul
        </button>
        <button aria-pressed={duo} onClick={() => setDuo(true)}>
          À deux
        </button>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ fontWeight: 700 }}>{plan.name}</span>
          <span className="small muted">{plan.goal}</span>
        </div>
        <PlanList plan={plan} />
        {duo && (
          <span className="small" style={{ color: 'var(--violet-ink)', background: 'var(--violet-tint)', padding: '10px 12px', borderRadius: 12 }}>
            {plan.duoRule}
          </span>
        )}
      </div>

      {last && (
        <div className="row small muted" style={{ gap: 8 }}>
          <Icon name="calendar" size={17} />
          Dernière fois en {format === 'enchainement' ? 'enchaînement' : FORMATS[format].name} ({shortDate(last.data.date)}) : {circuitScore(last.data)}
        </div>
      )}

      <button className="btn brand press" onClick={go}>
        <Icon name="timer" />
        Commencer
      </button>
    </Sheet>
  );
}

export function CircuitView({ id }: { id: string }) {
  const a = getDoc<Activity>(id)?.data;
  const now = useNow(250);
  const [finish, setFinish] = useState(false);

  useEffect(() => {
    void keepScreenOn(true);
    return () => void keepScreenOn(false);
  }, []);

  if (!a?.plan || !a.startedAt) return null;
  const plan = a.plan;
  const elapsed = Math.max(0, (now - new Date(a.startedAt).getTime()) / 1000);

  return (
    <main className="screen">
      <header className="screen-head">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{a.duo ? 'Type Hyrox · à deux' : 'Type Hyrox'}</span>
          <h1 className="title">{plan.name}</h1>
        </div>
        <button className="btn small ghost press" onClick={() => setFinish(true)}>
          Arrêter
        </button>
      </header>
      {plan.format === 'enchainement' && <Chain id={id} a={a} elapsed={elapsed} onDone={() => setFinish(true)} />}
      {plan.format === 'emom' && <Emom id={id} a={a} elapsed={elapsed} onDone={() => setFinish(true)} />}
      {plan.format === 'amrap' && <Amrap id={id} a={a} elapsed={elapsed} onDone={() => setFinish(true)} />}
      <CircuitFinish id={id} a={a} elapsed={elapsed} open={finish} onClose={() => setFinish(false)} />
    </main>
  );
}

type Part = { id: string; a: Activity; elapsed: number; onDone: () => void };

function Hero({ big, chip, bars, children }: { big: string; chip?: string; bars: ('done' | 'now' | 'todo' | 'miss')[]; children?: React.ReactNode }) {
  return (
    <section className="hero col" style={{ gap: 12 }}>
      <HeroLeaves />
      <div className="row between">
        <span className="hero-chip">
          <Icon name="timer" size={15} />
          Chrono
        </span>
        {chip && <span className="hero-chip">{chip}</span>}
      </div>
      <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{big}</span>
      <div className="row" style={{ gap: 3 }}>
        {bars.map((b, i) => (
          <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: b === 'done' ? '#BEF264' : b === 'miss' ? '#FCD34D' : b === 'now' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)' }} />
        ))}
      </div>
      {children}
    </section>
  );
}

function MoveCard({ label, item, right, children }: { label: string; item: CircuitPlan['items'][number]; right?: string; children?: React.ReactNode }) {
  return (
    <section className="card col" style={{ gap: 12 }}>
      <div className="row">
        <span className={'tile ' + (item.run ? 'tint-sky' : 'tint-orange')}>
          <Icon name={item.run ? 'run' : 'bolt'} />
        </span>
        <div className="grow col" style={{ gap: 1 }}>
          <span className="tiny muted" style={{ fontWeight: 500 }}>
            {label}
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{item.unit === 'reps' ? `${item.qty} ${item.name.toLowerCase()}` : `${item.name} · ${qtyText(item)}`}</span>
        </div>
        {right && (
          <span className="big-num" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {right}
          </span>
        )}
      </div>
      {item.load && (
        <span className="small" style={{ fontWeight: 600 }}>
          Charge : {item.load}
        </span>
      )}
      {item.alt && <span className="small muted">{item.alt}</span>}
      {children}
    </section>
  );
}

// ---------------- Enchaînement : course + station ----------------
function Chain({ id, a, elapsed, onDone }: Part) {
  const plan = a.plan!;
  const splits = a.splits ?? [];
  const idx = splits.length;
  const doneSum = splits.reduce((x, y) => x + y, 0);
  const segElapsed = Math.max(0, elapsed - doneSum);
  const cur = plan.items[idx];
  const next = plan.items[idx + 1];
  const finished = idx >= plan.items.length;
  const tour = Math.floor(Math.min(idx, plan.items.length - 1) / 2) + 1;

  async function mark() {
    haptic();
    const list = [...splits, Math.round(segElapsed)];
    await putDoc(id, 'activity', { ...a, splits: list });
    if (list.length >= plan.items.length) {
      tone('end');
      onDone();
    } else tone(plan.items[list.length].run ? 'go' : 'rest');
  }

  return (
    <>
      <Hero big={chrono(finished ? doneSum : elapsed)} chip={`Tour ${tour} sur ${plan.rounds}`} bars={plan.items.map((_, i) => (i < idx ? 'done' : i === idx ? 'now' : 'todo'))} />
      {cur && (
        <MoveCard label={cur.run ? `Course · tour ${tour}` : `Station · tour ${tour}`} item={cur} right={chrono(segElapsed)}>
          <button className="btn brand press" style={{ minHeight: 64, fontSize: 19 }} onClick={mark}>
            <Icon name="check" size={24} stroke={2.6} />
            {idx === plan.items.length - 1 ? 'Terminé !' : 'Fait, on enchaîne'}
          </button>
          {next && <span className="small muted">Ensuite : {next.run ? `course de ${qtyText(next)}` : itemText(next)}</span>}
        </MoveCard>
      )}
      {idx > 0 && (
        <section className="card tight">
          {splits
            .map((t, i) => ({ t, i, s: plan.items[i] }))
            .reverse()
            .map(({ t, i, s }, k, arr) => (
              <div key={i}>
                <div className="list-row">
                  <span className={'tile sm ' + (s.run ? 'tint-sky' : 'tint-orange')}>
                    <Icon name={s.run ? 'run' : 'bolt'} size={17} />
                  </span>
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {s.run ? `Course ${Math.floor(i / 2) + 1}` : s.name}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{chrono(t)}</span>
                </div>
                {k < arr.length - 1 && <div className="divider" />}
              </div>
            ))}
        </section>
      )}
      {idx > 0 && !finished && (
        <button className="btn ghost small press" onClick={() => void putDoc(id, 'activity', { ...a, splits: splits.slice(0, -1) })}>
          Annuler le dernier « Fait »
        </button>
      )}
    </>
  );
}

// ---------------- EMOM : un poste par minute ----------------
function Emom({ id, a, elapsed, onDone }: Part) {
  const plan = a.plan!;
  const total = plan.minutes;
  const m = Math.floor(elapsed / 60); // minute en cours, à partir de 0
  const left = Math.max(0, 60 - (elapsed % 60));
  const finished = m >= total;
  const cur = plan.items[m % plan.items.length];
  const next = plan.items[(m + 1) % plan.items.length];
  const missed = new Set(a.missed ?? []);
  const lastMin = useRef(-1);
  const lastTick = useRef(-1);

  useEffect(() => {
    if (finished) {
      if (lastMin.current !== total) {
        lastMin.current = total;
        tone('end');
        onDone();
      }
      return;
    }
    if (m !== lastMin.current) {
      if (lastMin.current >= 0) {
        tone('go');
        haptic();
      }
      lastMin.current = m;
    }
    const s = Math.ceil(left);
    if (s <= 3 && s >= 1 && s !== lastTick.current) {
      lastTick.current = s;
      tone('tick');
    }
  }, [m, left, finished]);

  async function toggleMiss() {
    const n = m + 1;
    const list = missed.has(n) ? [...missed].filter((x) => x !== n) : [...missed, n];
    await putDoc(id, 'activity', { ...a, missed: list });
  }

  if (finished) return <Hero big="Fini !" chip={`${total - missed.size} / ${total} min réussies`} bars={Array.from({ length: total }, (_, i) => (missed.has(i + 1) ? 'miss' : 'done'))} />;

  return (
    <>
      <Hero
        big={chrono(Math.ceil(left))}
        chip={`Minute ${m + 1} sur ${total}`}
        bars={Array.from({ length: total }, (_, i) => (i < m ? (missed.has(i + 1) ? 'miss' : 'done') : i === m ? 'now' : 'todo'))}
      >
        <span className="small on-hero-2">Total : {chrono(elapsed)} · poste {(m % plan.items.length) + 1} sur {plan.items.length}</span>
      </Hero>
      <MoveCard label={`Cette minute`} item={cur}>
        <button className={'btn press ' + (missed.has(m + 1) ? 'danger' : 'ghost')} onClick={toggleMiss}>
          {missed.has(m + 1) ? 'Minute ratée (toucher pour annuler)' : 'Je n’ai pas fini les reps'}
        </button>
        <span className="small muted">Minute suivante : {next.run ? `course de ${qtyText(next)}` : itemText(next)}</span>
      </MoveCard>
      <section className="card col" style={{ gap: 10 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Les {plan.items.length} postes, en boucle
        </span>
        <PlanList plan={plan} compact />
      </section>
    </>
  );
}

// ---------------- AMRAP : le plus de tours possible ----------------
function Amrap({ id, a, elapsed, onDone }: Part) {
  const plan = a.plan!;
  const total = plan.minutes * 60;
  const left = Math.max(0, total - elapsed);
  const finished = left <= 0;
  const rounds = a.rounds ?? 0;
  const ended = useRef(false);
  const lastTick = useRef(-1);

  useEffect(() => {
    if (finished && !ended.current) {
      ended.current = true;
      tone('end');
      onDone();
    }
    const s = Math.ceil(left);
    if (!finished && s <= 3 && s >= 1 && s !== lastTick.current) {
      lastTick.current = s;
      tone('tick');
    }
  }, [finished, left]);

  async function add(n: number) {
    haptic();
    if (n > 0) tone('rest');
    await putDoc(id, 'activity', { ...a, rounds: Math.max(0, rounds + n) });
  }

  return (
    <>
      <Hero big={chrono(left)} chip={`${rounds} tour${rounds > 1 ? 's' : ''}`} bars={Array.from({ length: plan.minutes }, (_, i) => (i < Math.floor(elapsed / 60) ? 'done' : i === Math.floor(elapsed / 60) ? 'now' : 'todo'))} />
      <section className="card col" style={{ gap: 12 }}>
        <div className="row between">
          <span style={{ fontWeight: 700 }}>Le circuit</span>
          <span className="small muted">à répéter</span>
        </div>
        <PlanList plan={plan} />
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost press" style={{ width: 64 }} aria-label="Retirer un tour" onClick={() => add(-1)} disabled={rounds === 0}>
            <Icon name="minus" />
          </button>
          <button className="btn brand press grow" style={{ minHeight: 64, fontSize: 19 }} onClick={() => add(1)} disabled={finished}>
            <Icon name="plus" size={22} stroke={2.6} />
            Tour terminé
          </button>
        </div>
      </section>
    </>
  );
}

// ---------------- Fin ----------------
function CircuitFinish({ id, a, elapsed, open, onClose }: { id: string; a: Activity; elapsed: number; open: boolean; onClose: () => void }) {
  const plan = a.plan!;
  const [rpe, setRpe] = useState(3);
  const [extra, setExtra] = useState(0);
  const complete =
    plan.format === 'enchainement' ? (a.splits?.length ?? 0) >= plan.items.length : elapsed >= plan.minutes * 60;
  const total = plan.format === 'enchainement' ? (complete ? (a.splits ?? []).reduce((x, y) => x + y, 0) : elapsed) : Math.min(elapsed, plan.minutes * 60);
  const done: Activity = { ...a, extra: plan.format === 'amrap' ? extra : undefined };

  async function save() {
    haptic();
    await putDoc(id, 'activity', { ...done, endedAt: new Date().toISOString(), minutes: Math.max(1, Math.round(total / 60)), rpe });
    void keepScreenOn(false);
    showToast(`Séance terminée : ${circuitScore(done)}. Bien joué !`);
  }

  async function drop() {
    await removeDoc(id);
    void keepScreenOn(false);
  }

  return (
    <Sheet open={open} onClose={complete ? () => undefined : onClose} title={complete ? 'Séance terminée' : 'Arrêter la séance ?'}>
      <div className="card col" style={{ gap: 2, background: complete ? 'var(--brand-tint)' : 'var(--card2)', boxShadow: 'none' }}>
        <span className="tiny muted">{plan.format === 'enchainement' ? 'Temps total' : plan.format === 'emom' ? 'Minutes réussies' : 'Tours'}</span>
        <span className="big-num">{plan.format === 'enchainement' ? chrono(total) : circuitScore(done)}</span>
        <span className="small muted">{plan.name}{a.duo ? ' · à deux' : ''}</span>
      </div>
      {plan.format === 'amrap' && (
        <div className="col" style={{ gap: 6 }}>
          <span className="small muted" style={{ fontWeight: 600 }}>
            Reps faites dans le tour pas terminé
          </span>
          <Stepper value={extra} onChange={setExtra} step={1} />
        </div>
      )}
      <div className="col" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Ressenti
        </span>
        <div className="segmented" role="group" aria-label="Ressenti">
          {['Facile', 'Moyen', 'Dur'].map((l, i) => (
            <button key={l} aria-pressed={rpe === i + 1} onClick={() => setRpe(i + 1)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <button className="btn brand press" onClick={save}>
        <Icon name="check" />
        {complete ? 'Enregistrer' : 'Enregistrer quand même'}
      </button>
      {!complete && (
        <>
          <button className="btn ghost press" onClick={onClose}>
            Reprendre
          </button>
          <button className="btn danger press" onClick={drop}>
            Abandonner sans enregistrer
          </button>
        </>
      )}
    </Sheet>
  );
}
