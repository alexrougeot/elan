import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tab } from '../App';
import { getData, getDoc, putDoc, removeDoc, useStoreVersion } from '../lib/store';
import { addDays, dayKey, fmtNum, fmtWeight, shortDate, WEEKDAYS } from '../lib/dates';
import { CATALOG, defaultRest, estimateMinutes, exName, platesFor, type Circuit, type Program, type ProgramDay } from '../lib/program';
import { autoAdjust, bestE1rm, e1rm, historyFor, prepareExercise, sessions, type Session, type SessionExercise } from '../lib/coach';
import { activeSession, adjustRest, getProgram, groupMembers, nextPending, planFor, sessionRecords, sessionStats, setRestSound, startRest, startSession, stopRest, updateSession, useRest, warmupsFor, type Readiness } from '../lib/workout';
import { haptic, keepScreenOn, tone, unlockAudio } from '../lib/device';
import { getLink, healthForSession, healthLine } from '../lib/health';
import { HeroLeaves, Icon, Ring, Sheet, Stepper, muscleTint, showToast, useNow } from '../components/ui';
import { ACTIVITY, activeCircuit, activities, activitiesOn, activityLine, takeCircuitAsk } from '../lib/activity';
import ActivitySheet from '../components/ActivitySheet';
import { CircuitStartSheet, CircuitView } from './Circuit';
import ExercisePicker from '../components/ExercisePicker';
import SkipSheet from '../components/SkipSheet';
import { fetchRun, openRun } from './Runs';

export default function Workout({ go, openProgram }: { go: (t: Tab) => void; openProgram: (dayId?: string) => void }) {
  useStoreVersion();
  const active = activeSession();
  if (active) return <SessionView id={active.id} />;
  const circuit = activeCircuit();
  if (circuit) return <CircuitView id={circuit.id} />;
  return <Planner go={go} openProgram={openProgram} />;
}

// ---------------- Choisir une séance ----------------
function Planner({ go, openProgram }: { go: (t: Tab) => void; openProgram: (dayId?: string) => void }) {
  const program = getProgram();
  const plan = planFor(program);
  const today = dayKey();
  const history = sessions().filter((s) => s.data.endedAt).slice(0, 12);
  const doneToday = history.find((s) => s.data.date === today);
  const [busy, setBusy] = useState(false);

  const [ask, setAsk] = useState<ProgramDay | null>(null);
  const [circuitOpen, setCircuitOpen] = useState(() => takeCircuitAsk());
  const [actOpen, setActOpen] = useState(false);
  const [skip, setSkip] = useState(false);
  const acts = activities().slice(0, 12);
  const feed = [
    ...history.map((s) => ({ at: s.data.startedAt, s, a: undefined })),
    ...acts.map((a) => ({ at: a.data.startedAt ?? a.data.date + 'T12:00:00', s: undefined, a })),
  ]
    .sort((x, y) => (x.at < y.at ? 1 : -1))
    .slice(0, 12);

  function start(day: ProgramDay) {
    if (!program || busy) return;
    unlockAudio();
    haptic();
    setAsk(day);
  }

  async function go2(score: Readiness) {
    if (!program || !ask) return;
    setBusy(true);
    const day = ask;
    setAsk(null);
    await startSession(day, program, score);
    setBusy(false);
  }

  return (
    <main className="screen">
      <header className="screen-head">
        <h1 className="title">Séance</h1>
        <button className="btn small ghost press" onClick={() => openProgram()}>
          <Icon name="edit" size={17} />
          Programme
        </button>
      </header>

      {!program || program.days.length === 0 ? (
        <div className="card empty">
          Ton programme est vide. Ajoute tes jours et tes exercices dans les réglages (roue crantée sur l’écran Aujourd’hui).
          <div style={{ marginTop: 12 }}>
            <button className="btn soft small press" onClick={() => go('today')}>
              Aller à l’accueil
            </button>
          </div>
        </div>
      ) : (
        <>
          {plan && (
            <section className="hero col" style={{ gap: 14 }}>
              <HeroLeaves />
              <div className="row between">
                <span className="hero-chip">
                  <Icon name="calendar" size={15} />
                  Aujourd’hui
                </span>
                <span className="hero-chip">
                  <Icon name="timer" size={15} />
                  {estimateMinutes(plan)} min
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {plan.title}
                {plan.subtitle ? ' · ' + plan.subtitle : ''}
              </h2>
              <div className="col" style={{ gap: 8 }}>
                {plan.exercises.map((e, i) => (
                  <div key={i} className="row between small">
                    <span className="row" style={{ gap: 10, fontWeight: 600 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                      {exName(e.key)}
                    </span>
                    <span className="on-hero-2">
                      {e.circuit
                        ? `${Math.round((e.circuit.rounds * e.circuit.keys.length * (e.circuit.work + e.circuit.rest)) / 60)} min`
                        : `${e.group ? 'SS ' + e.group + ' · ' : ''}${e.sets} × ${e.min === e.max ? e.min : `${e.min}-${e.max}`}${CATALOG[e.key]?.timed ? ' s' : ''}`}
                    </span>
                  </div>
                ))}
              </div>
              <button className="hero-btn press" onClick={() => start(plan)} disabled={busy}>
                <Icon name="dumbbell" />
                {doneToday ? 'Refaire cette séance' : 'Commencer la séance'}
              </button>
              <div className="row" style={{ gap: 8 }}>
                <button className="hero-chip press grow" style={{ border: 'none', justifyContent: 'center', minHeight: 40 }} onClick={() => openProgram(plan.id)}>
                  <Icon name="edit" size={15} />
                  Modifier les exercices
                </button>
                {!doneToday && (
                  <button className="hero-chip press grow" style={{ border: 'none', justifyContent: 'center', minHeight: 40 }} onClick={() => setSkip(true)}>
                    <Icon name="calendar" size={15} />
                    Pas aujourd’hui
                  </button>
                )}
              </div>
            </section>
          )}

          <div className="section-head">
            <h2 className="h2">{plan ? 'Une autre séance' : 'Choisir une séance'}</h2>
          </div>
          <div className="card tight">
            {program.days
              .filter((d) => d.id !== plan?.id)
              .map((d, i, arr) => (
                <div key={d.id}>
                  <button className="list-row press" onClick={() => start(d)}>
                    <span className="tile sm tint-sky">
                      <Icon name="dumbbell" size={18} />
                    </span>
                    <div className="grow col" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>
                        {d.title}
                        {d.subtitle ? ' · ' + d.subtitle : ''}
                      </span>
                      <span className="small muted">
                        {WEEKDAYS[d.weekday]} · {d.exercises.length} exercices · {estimateMinutes(d)} min
                      </span>
                    </div>
                    <Icon name="right" style={{ color: 'var(--ink3)' }} />
                  </button>
                  {i < arr.length - 1 && <div className="divider" />}
                </div>
              ))}
          </div>
        </>
      )}

      <div className="section-head">
        <h2 className="h2">Week-end et activités libres</h2>
      </div>
      <div className="card tight">
        <button className="list-row press" onClick={() => setCircuitOpen(true)}>
          <span className="tile sm tint-orange">
            <Icon name="bolt" size={18} />
          </span>
          <div className="grow col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 600 }}>Séance type Hyrox</span>
            <span className="small muted">3 formats au choix, nouveau contenu chaque semaine</span>
          </div>
          <Icon name="right" style={{ color: 'var(--ink3)' }} />
        </button>
        <div className="divider" />
        <button className="list-row press" onClick={fetchRun}>
          <span className="tile sm tint-sky">
            <Icon name="run" size={18} />
          </span>
          <div className="grow col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 600 }}>Course</span>
            <span className="small muted">Récupérée de ta montre, avec le parcours</span>
          </div>
          <Icon name="right" style={{ color: 'var(--ink3)' }} />
        </button>
        <div className="divider" />
        <button className="list-row press" onClick={() => setActOpen(true)}>
          <span className="tile sm tint-violet">
            <Icon name="plus" size={18} />
          </span>
          <div className="grow col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 600 }}>Noter une activité à la main</span>
            <span className="small muted">Vélo, natation, marche, course sans montre…</span>
          </div>
          <Icon name="right" style={{ color: 'var(--ink3)' }} />
        </button>
      </div>

      {feed.length > 0 && (
        <>
          <div className="section-head">
            <h2 className="h2">Dernières séances</h2>
          </div>
          <div className="card tight">
            {feed.map(({ s, a }, i) => {
              if (a)
                return (
                  <div key={a.id}>
                    <div className={'list-row' + (a.data.type === 'course' ? ' press' : '')} role={a.data.type === 'course' ? 'button' : undefined} tabIndex={a.data.type === 'course' ? 0 : undefined} onClick={a.data.type === 'course' ? () => openRun(a.id) : undefined}>
                      <span className={'tile sm ' + (a.data.type === 'circuit' ? 'tint-orange' : 'tint-sky')}>
                        <Icon name={ACTIVITY[a.data.type].icon} size={18} />
                      </span>
                      <div className="grow col" style={{ gap: 2 }}>
                        <span style={{ fontWeight: 600 }}>{ACTIVITY[a.data.type].label}</span>
                        <span className="small muted">
                          {shortDate(a.data.date)} · {activityLine(a.data)}
                        </span>
                      </div>
                    </div>
                    {i < feed.length - 1 && <div className="divider" />}
                  </div>
                );
              if (!s) return null;
              const st = sessionStats(s.data);
              const min = s.data.endedAt ? Math.round((new Date(s.data.endedAt).getTime() - new Date(s.data.startedAt).getTime()) / 60000) : 0;
              return (
                <div key={s.id}>
                  <div className="list-row">
                    <span className="tile sm tint-brand">
                      <Icon name="check" size={18} stroke={2.6} />
                    </span>
                    <div className="grow col" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{s.data.title}</span>
                      <span className="small muted">
                        {shortDate(s.data.date)} · {min} min · {st.sets} séries · {fmtNum(st.volume)} kg soulevés
                      </span>
                      {healthForSession(s.id) && (
                        <span className="tiny" style={{ color: 'var(--sky-ink)', fontWeight: 600 }}>
                          {healthForSession(s.id)!.source} : {healthLine(healthForSession(s.id)!)}
                        </span>
                      )}
                    </div>
                  </div>
                  {i < feed.length - 1 && <div className="divider" />}
                </div>
              );
            })}
          </div>
        </>
      )}
      <ReadinessSheet day={ask} onClose={() => setAsk(null)} onPick={go2} />
      <CircuitStartSheet open={circuitOpen} onClose={() => setCircuitOpen(false)} />
      <ActivitySheet open={actOpen} onClose={() => setActOpen(false)} />
      <SkipSheet open={skip} onClose={() => setSkip(false)} />
    </main>
  );
}

// ---------------- Séance en cours ----------------
type Edit = { ei: number; sj: number } | null;

function SessionView({ id }: { id: string }) {
  const s = getDoc<Session>(id)?.data as Session;
  const now = useNow(1000);
  const rest = useRest();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [edit, setEdit] = useState<Edit>(null);
  const [replace, setReplace] = useState<number | null>(null);
  const [plates, setPlates] = useState<number | null>(null);
  const [finish, setFinish] = useState(false);
  const [circuitFor, setCircuitFor] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addToProgram, setAddToProgram] = useState(false);

  useEffect(() => {
    void keepScreenOn(true);
    const st = getData<{ sound?: boolean }>('settings');
    setRestSound(st?.sound !== false);
    return () => void keepScreenOn(false);
  }, []);

  if (!s) return null;
  const next = nextPending(s);
  const currentGroup = next ? groupMembers(s, next.ei) : [];
  const elapsed = Math.max(0, Math.floor((now - new Date(s.startedAt).getTime()) / 1000));
  const totalSets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);

  async function goOn(ei: number, sj: number, adjustText?: string, undo?: () => void) {
    const after = getDoc<Session>(id)!.data;
    const n = nextPending(after);
    if (!n) {
      stopRest();
      setFinish(true);
      return;
    }
    const sameGroup = n.ei !== ei && groupMembers(after, ei).includes(n.ei);
    if (n.ei !== ei) setTimeout(() => document.getElementById('ex-' + n.ei)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    if (sameGroup && n.sj === sj) {
      // superset : on enchaîne sans repos
      stopRest();
      showToast(adjustText ?? `Enchaîne : ${exName(after.exercises[n.ei].key)}`, undo ? { label: 'Annuler', run: undo } : undefined, adjustText ? 5000 : 2500);
      return;
    }
    if (adjustText) showToast(adjustText, undo ? { label: 'Annuler', run: undo } : undefined, 5000);
    const label = n.ei === ei ? `Série ${n.sj + 1} · ${exName(after.exercises[ei].key)}` : sameGroup ? `Série ${n.sj + 1} · superset` : `Prochain : ${exName(after.exercises[n.ei].key)}`;
    if (after.exercises[ei].planned.rest > 0) startRest(after.exercises[ei].planned.rest, label);
  }

  async function validate(ei: number, sj: number) {
    unlockAudio();
    haptic();
    const ex = s.exercises[ei];
    const set = ex.sets[sj];
    if (set.done) {
      await updateSession(id, (x) => {
        x.exercises[ei].sets[sj].done = false;
        return x;
      });
      return;
    }
    // Record ?
    const prev = bestE1rm(ex.key, id);
    const inSession = Math.max(0, ...ex.sets.filter((x) => x.done).map((x) => e1rm(x.w, x.r)));
    const v = e1rm(set.w, set.r);
    const record = prev > 0 && v > Math.max(prev, inSession) && !CATALOG[ex.key]?.timed;
    // Ajustement en direct des séries suivantes
    const adj = autoAdjust(ex, set.w, set.r);
    const before = ex.sets.map((x) => ({ w: x.w, r: x.r }));
    await updateSession(id, (x) => {
      const sets = x.exercises[ei].sets;
      sets[sj].done = true;
      sets[sj].at = new Date().toISOString();
      if (adj) for (let k = sj + 1; k < sets.length; k++) if (!sets[k].done) sets[k] = { ...sets[k], w: adj.w, r: adj.r };
      return x;
    });
    const undo = adj
      ? () =>
          void updateSession(id, (x) => {
            const sets = x.exercises[ei].sets;
            for (let k = sj + 1; k < sets.length; k++) if (!sets[k].done && before[k]) sets[k] = { ...sets[k], w: before[k].w, r: before[k].r };
            return x;
          })
      : undefined;
    if (record) showToast(`Nouveau record sur ${exName(ex.key)} : ${fmtWeight(set.w)} kg × ${set.r}`, undefined, 4500);
    await goOn(ei, sj, adj && !record ? adj.text : undefined, undo);
  }

  async function circuitDone(ei: number) {
    tone('end');
    await updateSession(id, (x) => {
      for (const st of x.exercises[ei].sets) {
        st.done = true;
        st.at = new Date().toISOString();
      }
      return x;
    });
    setCircuitFor(null);
    showToast('Abdos terminés, bravo !');
    const after = getDoc<Session>(id)!.data;
    if (!nextPending(after)) setFinish(true);
  }

  async function addSet(ei: number) {
    haptic();
    await updateSession(id, (x) => {
      const sets = x.exercises[ei].sets;
      const last = sets[sets.length - 1] ?? { w: 0, r: x.exercises[ei].planned.min };
      sets.push({ w: last.w, r: last.r, done: false });
      return x;
    });
  }

  async function removeSet(ei: number) {
    await updateSession(id, (x) => {
      const sets = x.exercises[ei].sets;
      const idx = [...sets].reverse().findIndex((y) => !y.done);
      if (idx >= 0 && sets.length > 1) sets.splice(sets.length - 1 - idx, 1);
      return x;
    });
  }

  async function removeExercise(ei: number) {
    haptic();
    const before = getDoc<Session>(id)!.data;
    const removed = before.exercises[ei];
    await updateSession(id, (x) => {
      x.exercises.splice(ei, 1);
      return x;
    });
    showToast(`${exName(removed.key)} retiré de la séance`, {
      label: 'Annuler',
      run: () =>
        void updateSession(id, (x) => {
          x.exercises.splice(ei, 0, removed);
          return x;
        }),
    });
  }

  async function addExercise(key: string) {
    haptic();
    const def = CATALOG[key];
    const planned = { key, sets: 3, min: def?.timed ? 30 : 8, max: def?.timed ? 45 : 12, rest: defaultRest(key) };
    const prepared = prepareExercise(planned, !!s.deload, id);
    let at = 0;
    await updateSession(id, (x) => {
      // les abdos restent à la fin
      const circuit = x.exercises.findIndex((e) => e.planned.circuit);
      at = circuit >= 0 ? circuit : x.exercises.length;
      x.exercises.splice(at, 0, prepared);
      return x;
    });
    if (addToProgram) {
      const program = getData<Program>('program');
      const day = program?.days.find((d) => d.id === s.dayId);
      if (program && day) {
        const next = structuredClone(program);
        const nd = next.days.find((d) => d.id === s.dayId)!;
        const c = nd.exercises.findIndex((e) => e.circuit);
        nd.exercises.splice(c >= 0 ? c : nd.exercises.length, 0, planned);
        await putDoc('program', 'program', next);
      }
    }
    setAdding(false);
    setAddToProgram(false);
    setExpanded((m) => ({ ...m, [at]: true }));
    showToast(`${exName(key)} ajouté${addToProgram ? ' à la séance et au programme' : ' à la séance'}`);
    setTimeout(() => document.getElementById('ex-' + at)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }

  const mm = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

  return (
    <main className="screen" style={{ paddingBottom: rest ? 'calc(var(--tab-h) + var(--safe-b) + 110px)' : undefined }}>
      <header className="screen-head">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">
            {mm(elapsed)} · {doneSets} / {totalSets} séries
          </span>
          <h1 className="title" style={{ fontSize: 28 }}>
            {s.title}
            {s.subtitle ? ' · ' + s.subtitle : ''}
          </h1>
        </div>
        <button className="btn small press" style={{ background: 'var(--ink)', color: 'var(--bg)' }} onClick={() => setFinish(true)}>
          Terminer
        </button>
      </header>
      <div className="progress-line" role="progressbar" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={doneSets} aria-label="Progression de la séance">
        <div style={{ width: (totalSets ? (doneSets / totalSets) * 100 : 0) + '%' }} />
      </div>

      {s.exercises.filter((e) => e.tip.kind === 'new').length >= Math.ceil(s.exercises.filter((e) => !e.planned.circuit).length / 2) && (
        <div className="card row" style={{ background: 'var(--sky-tint)', boxShadow: 'none', alignItems: 'flex-start' }}>
          <Icon name="info" style={{ color: 'var(--sky-ink)', marginTop: 2 }} />
          <span className="small" style={{ color: 'var(--sky-ink)', lineHeight: 1.45 }}>
            <b>Semaine de calibration.</b> Mets les charges avec lesquelles tu travailles d’habitude. Dès la prochaine séance, Élan s’en sert pour calculer tes charges et tes échauffements, puis il ajuste après chaque séance.
          </span>
        </div>
      )}

      {s.deload && (
        <div className="card row" style={{ background: 'var(--amber-tint)', boxShadow: 'none' }}>
          <Icon name="info" style={{ color: 'var(--amber-ink)' }} />
          <span className="small" style={{ color: 'var(--amber-ink)' }}>
            Semaine légère : garde 2 ou 3 reps en réserve sur chaque série.
          </span>
        </div>
      )}

      {s.exercises.map((ex, ei) =>
        ex.planned.circuit ? (
          <CircuitCard key={ei + ex.key} id={'ex-' + ei} ex={ex} isCurrent={currentGroup.includes(ei)} onStart={() => setCircuitFor(ei)} />
        ) : (
        <ExerciseCard
          key={ei + ex.key}
          id={'ex-' + ei}
          sid={id}
          ex={ex}
          isCurrent={currentGroup.includes(ei)}
          activeSj={next && next.ei === ei ? next.sj : -1}
          partner={ex.planned.group ? groupMembers(s, ei).filter((k) => k !== ei).map((k) => exName(s.exercises[k].key)).join(', ') : undefined}
          open={expanded[ei] ?? currentGroup.includes(ei)}
          onToggle={() => setExpanded((m) => ({ ...m, [ei]: !(m[ei] ?? currentGroup.includes(ei)) }))}
          onEdit={(sj) => setEdit({ ei, sj })}
          onValidate={(sj) => validate(ei, sj)}
          onAddSet={() => addSet(ei)}
          onRemoveSet={() => removeSet(ei)}
          onReplace={() => setReplace(ei)}
          onRemove={() => removeExercise(ei)}
          onPlates={() => setPlates(ei)}
          onWarm={(i) =>
            void updateSession(id, (x) => {
              const w = x.exercises[ei].warm ?? [];
              w[i] = !w[i];
              x.exercises[ei].warm = w;
              return x;
            })
          }
        />
        )
      )}

      <button className="btn ghost press" onClick={() => setAdding(true)}>
        <Icon name="plus" size={18} />
        Ajouter un exercice
      </button>

      {rest && <RestBar />}

      <ExercisePicker
        open={adding}
        onClose={() => setAdding(false)}
        onPick={addExercise}
        footer={
          <label className="row small" style={{ gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={addToProgram} onChange={(e) => setAddToProgram(e.target.checked)} style={{ width: 22, minHeight: 22, accentColor: 'var(--brand-ink)' }} />
            L’ajouter aussi à mon programme ({s.title})
          </label>
        }
      />
      <SetEditor sid={id} session={s} edit={edit} onClose={() => setEdit(null)} />
      <ReplaceSheet sid={id} session={s} index={replace} onClose={() => setReplace(null)} />
      <PlatesSheet session={s} index={plates} onClose={() => setPlates(null)} />
      <FinishSheet sid={id} session={s} open={finish} onClose={() => setFinish(false)} />
      <CircuitSheet
        circuit={circuitFor !== null ? s.exercises[circuitFor]?.planned.circuit : undefined}
        onClose={() => setCircuitFor(null)}
        onDone={() => circuitFor !== null && circuitDone(circuitFor)}
      />
    </main>
  );
}

function ExerciseCard({
  id,
  sid,
  ex,
  isCurrent,
  activeSj,
  partner,
  open,
  onToggle,
  onEdit,
  onValidate,
  onAddSet,
  onRemoveSet,
  onReplace,
  onRemove,
  onPlates,
  onWarm,
}: {
  id: string;
  sid: string;
  ex: SessionExercise;
  isCurrent: boolean;
  activeSj: number;
  partner?: string;
  open: boolean;
  onToggle: () => void;
  onEdit: (sj: number) => void;
  onValidate: (sj: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onPlates: () => void;
  onWarm: (i: number) => void;
}) {
  const def = CATALOG[ex.key];
  const bar = getData<{ bar?: number }>('settings')?.bar ?? 20;
  const warm = ex.sets[0] && !ex.sets[0].done ? warmupsFor(ex.key, ex.sets[0].w, bar) : [];
  const timed = !!def?.timed;
  const last = useMemo(() => historyFor(ex.key, sid)[0], [ex.key, sid]);
  const allDone = ex.sets.every((x) => x.done);
  const range = ex.planned.min === ex.planned.max ? `${ex.planned.min}` : `${ex.planned.min}-${ex.planned.max}`;
  const restTxt = ex.planned.rest >= 60 ? `${Math.floor(ex.planned.rest / 60)} min${ex.planned.rest % 60 ? ' ' + (ex.planned.rest % 60) : ''}` : `${ex.planned.rest} s`;
  const tipColor = ex.tip.kind === 'up' ? 'var(--brand-deep)' : ex.tip.kind === 'down' || ex.tip.kind === 'deload' ? 'var(--amber-ink)' : 'var(--ink)';
  const tipBg = ex.tip.kind === 'up' ? 'var(--brand-tint)' : ex.tip.kind === 'down' || ex.tip.kind === 'deload' ? 'var(--amber-tint)' : 'var(--line2)';

  return (
    <section id={id} className="card col" style={{ gap: 12, scrollMarginTop: 16, boxShadow: isCurrent ? 'var(--shadow), inset 0 0 0 1.5px color-mix(in srgb, var(--brand) 40%, transparent)' : undefined }}>
      <button className="row" style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', minHeight: 44 }} onClick={onToggle} aria-expanded={open}>
        <div className="grow col" style={{ gap: 4 }}>
          <span className="row" style={{ gap: 6 }}>
            {def && <span className={'muscle ' + muscleTint(def.muscle)}>{def.muscle}</span>}
            {ex.planned.group && <span className="muscle tint-violet">Superset {ex.planned.group}</span>}
          </span>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.015em' }}>{exName(ex.key)}</span>
          <span className="small muted">
            {ex.sets.length} × {range}
            {timed ? ' s' : ' reps'} · repos {restTxt}
            {ex.planned.group ? ' après le superset' : ''}
            {def?.equipment === 'haltères' ? ' · charge par haltère' : ''}
          </span>
        </div>
        {allDone ? (
          <span className="badge">
            <Icon name="check" size={14} stroke={2.6} />
            Fait
          </span>
        ) : (
          <Icon name={open ? 'down' : 'right'} style={{ color: 'var(--ink3)' }} />
        )}
      </button>

      {open && (
        <>
          {last && (
            <div className="small muted">
              Dernière fois ({shortDate(last.date)}) :{' '}
              {last.ex.sets
                .filter((x) => x.done)
                .map((x) => (timed ? `${x.r} s` : `${fmtWeight(x.w)}×${x.r}`))
                .join(' · ')}
            </div>
          )}
          <div className="row small" style={{ alignItems: 'flex-start', gap: 10, background: tipBg, color: tipColor, padding: '11px 13px', borderRadius: 14, lineHeight: 1.4 }}>
            <Icon name={ex.tip.kind === 'up' ? 'up' : ex.tip.kind === 'down' ? 'arrowDown' : 'info'} size={18} style={{ marginTop: 1 }} />
            <span>
              <b>Coach :</b> {ex.tip.text}
            </span>
          </div>
          {partner && (
            <div className="small" style={{ color: 'var(--violet-ink)', fontWeight: 600 }}>
              Enchaîne chaque série avec {partner}, sans pause.
            </div>
          )}
          {ex.planned.note && <div className="small muted">{ex.planned.note}</div>}

          <div className="col" style={{ gap: 6 }}>
            <div className="set-row tiny muted" style={{ minHeight: 18, fontWeight: 600 }}>
              <span>Série</span>
              <span>{timed ? '' : 'Charge'}</span>
              <span>{timed ? 'Durée' : 'Reps'}</span>
              <span />
            </div>
            {warm.map((w, i) => (
              <div key={'w' + i} className="set-row" style={{ minHeight: 44, opacity: ex.warm?.[i] ? 0.55 : 1 }}>
                <span className="tiny" style={{ fontWeight: 700, color: 'var(--sky-ink)' }}>Éch.</span>
                <span className="small" style={{ fontWeight: 600, paddingLeft: 10 }}>
                  {fmtWeight(w.w)} kg
                </span>
                <span className="small" style={{ fontWeight: 600, paddingLeft: 10 }}>
                  {w.r} reps
                </span>
                <button className={'check press ' + (ex.warm?.[i] ? 'done' : 'todo')} style={{ width: 44, height: 38 }} aria-label={`Échauffement ${i + 1} ${ex.warm?.[i] ? 'fait' : 'à faire'}`} onClick={() => onWarm(i)}>
                  <Icon name="check" size={16} />
                </button>
              </div>
            ))}
            {warm.length === 0 && ex.sets[0] && !ex.sets[0].done && ex.sets[0].w === 0 && def?.compound && !def.timed && (
              <div className="tiny" style={{ color: 'var(--sky-ink)', padding: '0 8px' }}>
                Échauffement : 2 séries légères (barre ou charge légère, puis la moitié de ta charge). Dès que tu mets ta charge, Élan les calcule.
              </div>
            )}
            {ex.sets.map((x, sj) => {
              const active = sj === activeSj;
              return (
                <div key={sj} className={'set-row' + (active ? ' active' : '')}>
                  <span style={{ fontWeight: 700, color: x.done ? 'var(--ink2)' : 'var(--ink)' }}>{sj + 1}</span>
                  {timed ? (
                    <span />
                  ) : (
                    <button className="set-val press" onClick={() => onEdit(sj)} aria-label={`Charge de la série ${sj + 1}`}>
                      {x.w > 0 ? fmtWeight(x.w) : '—'}
                      <small>kg</small>
                    </button>
                  )}
                  <button className="set-val press" onClick={() => onEdit(sj)} aria-label={`${timed ? 'Durée' : 'Reps'} de la série ${sj + 1}`}>
                    {x.r}
                    <small>{timed ? 's' : 'reps'}</small>
                  </button>
                  <button
                    className={'check press ' + (x.done ? 'done' : active ? '' : 'todo')}
                    aria-label={x.done ? `Annuler la série ${sj + 1}` : `Valider la série ${sj + 1}`}
                    aria-pressed={x.done}
                    onClick={() => onValidate(sj)}
                  >
                    {x.done ? <Icon name="check" stroke={2.6} /> : active ? 'OK' : <Icon name="check" size={18} />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="chip press" onClick={onAddSet}>
              <Icon name="plus" size={16} />
              Série
            </button>
            {ex.sets.some((x) => !x.done) && ex.sets.length > 1 && (
              <button className="chip press" onClick={onRemoveSet}>
                <Icon name="minus" size={16} />
                Série
              </button>
            )}
            <button className="chip press" onClick={onReplace}>
              <Icon name="swap" size={16} />
              Changer
            </button>
            {!ex.sets.some((x) => x.done) && (
              <button className="chip press" onClick={onRemove}>
                <Icon name="trash" size={16} />
                Retirer
              </button>
            )}
            {def?.equipment === 'barre' && (
              <button className="chip press" onClick={onPlates}>
                Disques
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function RestBar() {
  const rest = useRest();
  const now = useNow(250);
  if (!rest) return null;
  const left = Math.ceil((rest.endsAt - now) / 1000);
  const over = left <= 0;
  const shown = Math.max(0, left);
  const txt = `${Math.floor(shown / 60)}:${String(shown % 60).padStart(2, '0')}`;
  return (
    <div className="rest-bar" role="timer" aria-live="off" aria-label={`Repos, ${txt} restant`} style={over ? { background: 'var(--brand-ink)', color: '#fff' } : undefined}>
      <Ring value={over ? 1 : Math.max(0, (rest.endsAt - now) / (rest.total * 1000))} size={50} stroke={12} color={over ? '#fff' : 'var(--brand)'}>
        <Icon name="timer" size={16} />
      </Ring>
      <div className="grow col" style={{ gap: 0 }}>
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{over ? 'C’est reparti' : txt}</span>
        <span className="tiny" style={{ opacity: over ? 0.9 : undefined, color: over ? '#fff' : 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rest.label}
        </span>
      </div>
      {!over && (
        <>
          <button className="icon-btn press" style={{ width: 46 }} aria-label="Moins 15 secondes" onClick={() => adjustRest(-15)}>
            −15
          </button>
          <button className="icon-btn press" style={{ width: 46 }} aria-label="Plus 15 secondes" onClick={() => adjustRest(15)}>
            +15
          </button>
        </>
      )}
      <button
        className="icon-btn press"
        style={{ width: 'auto', padding: '0 12px', fontWeight: 700, background: over ? '#fff' : 'var(--brand-tint)', color: over ? 'var(--brand-ink)' : 'var(--brand-deep)' }}
        onClick={stopRest}
      >
        {over ? 'OK' : 'Passer'}
      </button>
    </div>
  );
}

function SetEditor({ sid, session, edit, onClose }: { sid: string; session: Session; edit: Edit; onClose: () => void }) {
  const ex = edit ? session.exercises[edit.ei] : undefined;
  const def = ex ? CATALOG[ex.key] : undefined;
  const timed = !!def?.timed;
  const [w, setW] = useState(0);
  const [r, setR] = useState(0);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    if (!edit || !ex) return;
    setW(ex.sets[edit.sj].w);
    setR(ex.sets[edit.sj].r);
    setFollowing(true);
  }, [edit?.ei, edit?.sj]);

  if (!ex || !edit) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const step = def && def.increment >= 2.5 ? 2.5 : 1;
  const bar = getData<{ bar?: number }>('settings')?.bar ?? 20;
  const pl = def?.equipment === 'barre' ? platesFor(w, bar) : null;

  async function save() {
    haptic();
    await updateSession(sid, (x) => {
      const sets = x.exercises[edit!.ei].sets;
      sets[edit!.sj].w = w;
      sets[edit!.sj].r = r;
      if (following) for (let j = edit!.sj + 1; j < sets.length; j++) if (!sets[j].done) sets[j].w = w;
      return x;
    });
    onClose();
  }

  return (
    <Sheet open={!!edit} onClose={onClose} title={`${exName(ex.key)} · série ${edit.sj + 1}`}>
      {!timed && (
        <div className="col" style={{ gap: 10 }}>
          <span className="small muted" style={{ fontWeight: 600 }}>
            Charge{def?.equipment === 'haltères' ? ' par haltère' : ''}
          </span>
          <Stepper value={w} onChange={setW} step={step} unit="kg" format={fmtWeight} />
          <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[-10, -5, 5, 10].map((d) => (
              <button key={d} className="chip press" onClick={() => setW(Math.max(0, w + d))}>
                {d > 0 ? '+' : '−'}
                {Math.abs(d)} kg
              </button>
            ))}
          </div>
          {pl && w > bar && (
            <div className="small muted" style={{ textAlign: 'center' }}>
              De chaque côté : {pl.plates.length ? pl.plates.map(fmtWeight).join(' + ') + ' kg' : 'rien'}
              {!pl.ok && ` (il manque ${fmtWeight(pl.rest * 2)} kg)`}
            </div>
          )}
          <label className="row small" style={{ gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={following} onChange={(e) => setFollowing(e.target.checked)} style={{ width: 22, minHeight: 22, accentColor: 'var(--brand-ink)' }} />
            Appliquer aux séries suivantes
          </label>
        </div>
      )}
      <div className="col" style={{ gap: 10 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          {timed ? 'Durée' : 'Répétitions'}
        </span>
        <Stepper value={r} onChange={setR} step={timed ? 5 : 1} unit={timed ? 's' : 'reps'} />
      </div>
      <button className="btn brand press" onClick={save}>
        OK
      </button>
    </Sheet>
  );
}

function ReplaceSheet({ sid, session, index, onClose }: { sid: string; session: Session; index: number | null; onClose: () => void }) {
  const [inProgram, setInProgram] = useState(false);
  const ex = index !== null ? session.exercises[index] : undefined;
  const def = ex ? CATALOG[ex.key] : undefined;
  const options = useMemo(() => {
    if (!def) return [];
    const alt = def.alternatives.filter((k) => CATALOG[k]);
    const same = Object.values(CATALOG)
      .filter((c) => c.muscle === def.muscle && c.key !== def.key && !alt.includes(c.key) && !c.circuit)
      .map((c) => c.key);
    return [...alt, ...same].slice(0, 8);
  }, [def?.key]);

  async function pick(key: string) {
    if (index === null || !ex) return;
    haptic();
    const def2 = CATALOG[key];
    const planned = def2?.timed && !CATALOG[ex.key]?.timed ? { ...ex.planned, key, min: 30, max: 45 } : { ...ex.planned, key };
    const prepared = prepareExercise(planned, !!session.deload, sid);
    await updateSession(sid, (x) => {
      x.exercises[index] = { ...prepared, swappedFrom: ex.key };
      return x;
    });
    if (inProgram) {
      const program = getData<Program>('program');
      if (program) {
        const next = structuredClone(program);
        for (const d of next.days) if (d.id === session.dayId) for (const pe of d.exercises) if (pe.key === ex.key) pe.key = key;
        await putDoc('program', 'program', next);
      }
    }
    showToast(`${exName(ex.key)} remplacé par ${exName(key)}`);
    setInProgram(false);
    onClose();
  }

  return (
    <ExercisePicker
      open={index !== null}
      onClose={onClose}
      onPick={pick}
      title={ex ? `Changer : ${exName(ex.key)}` : 'Changer l’exercice'}
      first={def ? { label: `Pour les mêmes muscles (${def.muscle.toLowerCase()})`, keys: options } : undefined}
      footer={
        <label className="row small" style={{ gap: 10, minHeight: 44 }}>
          <input type="checkbox" checked={inProgram} onChange={(e) => setInProgram(e.target.checked)} style={{ width: 22, minHeight: 22, accentColor: 'var(--brand-ink)' }} />
          Le remplacer aussi dans mon programme
        </label>
      }
    />
  );
}

const PLATE_COLORS: Record<string, string> = { '25': '#DC2626', '20': '#2563EB', '15': '#CA8A04', '10': '#16A34A', '5': '#334155', '2.5': '#64748B', '1.25': '#94A3B8' };

function PlatesSheet({ session, index, onClose }: { session: Session; index: number | null; onClose: () => void }) {
  const ex = index !== null ? session.exercises[index] : undefined;
  const settings = getData<{ bar?: number }>('settings');
  const [bar, setBar] = useState(settings?.bar ?? 20);
  const [w, setW] = useState(60);
  useEffect(() => {
    if (!ex) return;
    const next = ex.sets.find((x) => !x.done) ?? ex.sets[ex.sets.length - 1];
    setW(next?.w || 60);
  }, [index]);
  const res = platesFor(w, bar);

  return (
    <Sheet open={index !== null} onClose={onClose} title="Calcul des disques">
      <Stepper value={w} onChange={setW} step={2.5} unit="kg" format={fmtWeight} min={bar} />
      <div className="col" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Barre
        </span>
        <div className="segmented" role="group" aria-label="Poids de la barre">
          {[20, 15, 10].map((b) => (
            <button key={b} aria-pressed={bar === b} onClick={() => setBar(b)}>
              {b} kg
            </button>
          ))}
        </div>
      </div>
      <div className="card col" style={{ gap: 12, background: 'var(--card2)', boxShadow: 'none', alignItems: 'center' }}>
        <span className="small muted">De chaque côté</span>
        <div className="row" style={{ gap: 4, alignItems: 'center', minHeight: 100 }} aria-hidden="true">
          <div style={{ width: 34, height: 10, borderRadius: 3, background: '#94A3B8' }} />
          {res.plates.map((p, i) => (
            <div key={i} className="plate" style={{ background: PLATE_COLORS[String(p)], height: 40 + p * 2.4, width: p >= 10 ? 26 : 20 }}>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{fmtWeight(p)}</span>
            </div>
          ))}
          <div style={{ width: 22, height: 10, borderRadius: 3, background: '#94A3B8' }} />
        </div>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{res.plates.length ? res.plates.map(fmtWeight).join(' + ') + ' kg' : 'Barre seule'}</span>
        {!res.ok && <span className="small" style={{ color: 'var(--amber-ink)' }}>Impossible pile avec ces disques : il manque {fmtWeight(res.rest * 2)} kg.</span>}
      </div>
    </Sheet>
  );
}

function FinishSheet({ sid, session, open, onClose }: { sid: string; session: Session; open: boolean; onClose: () => void }) {
  const st = sessionStats(session);
  const records = open ? sessionRecords(sid, session) : [];
  const left = session.exercises.reduce((a, e) => a + e.sets.filter((x) => !x.done).length, 0);
  const min = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000);
  const [confirmDrop, setConfirmDrop] = useState(false);

  async function end() {
    haptic();
    stopRest();
    await updateSession(sid, (x) => ({ ...x, endedAt: new Date().toISOString() }));
    void keepScreenOn(false);
    showToast(records.length ? `Séance terminée, avec ${records.length} record${records.length > 1 ? 's' : ''} !` : 'Séance terminée. Bien joué !');
    onClose();
  }

  async function drop() {
    stopRest();
    await removeDoc(sid);
    void keepScreenOn(false);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Terminer la séance">
      <div className="fields-2">
        <div className="card col" style={{ gap: 2, background: 'var(--card2)', boxShadow: 'none' }}>
          <span className="tiny muted">Durée</span>
          <span className="big-num">{min} min</span>
        </div>
        <div className="card col" style={{ gap: 2, background: 'var(--card2)', boxShadow: 'none' }}>
          <span className="tiny muted">Volume</span>
          <span className="big-num">{fmtNum(st.volume)} kg</span>
        </div>
      </div>
      {records.length > 0 && (
        <div className="card col" style={{ gap: 8, background: 'var(--brand-tint)', boxShadow: 'none' }}>
          <span className="row small" style={{ fontWeight: 700, color: 'var(--brand-deep)', gap: 8 }}>
            <Icon name="trophy" size={18} />
            Records battus
          </span>
          {records.map((r) => (
            <span key={r.key} className="small" style={{ color: 'var(--brand-deep)' }}>
              {exName(r.key)} : {fmtWeight(r.w)} kg × {r.r}
            </span>
          ))}
        </div>
      )}
      {getLink() && (
        <p className="small muted" style={{ margin: 0 }}>
          Pense à arrêter aussi l’entraînement sur ta montre : ses calories et ton cœur arriveront ensuite dans Élan.
        </p>
      )}
      {left > 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          Il reste {left} série{left > 1 ? 's' : ''} non validée{left > 1 ? 's' : ''}. Elles ne compteront pas pour le coach.
        </p>
      )}
      <button className="btn brand press" onClick={end}>
        Terminer la séance
      </button>
      {!confirmDrop ? (
        <button className="btn ghost press" onClick={() => setConfirmDrop(true)}>
          Abandonner sans enregistrer
        </button>
      ) : (
        <button className="btn danger press" onClick={drop}>
          Oui, supprimer cette séance
        </button>
      )}
    </Sheet>
  );
}

// ---------------- Abdos en circuit ----------------
function circuitLabels(keys: string[]) {
  return keys.map((k, i) => {
    const same = keys.filter((x) => x === k).length;
    if (same < 2) return exName(k);
    const nth = keys.slice(0, i + 1).filter((x) => x === k).length;
    return `${exName(k)} (côté ${nth})`;
  });
}

function CircuitCard({ id, ex, isCurrent, onStart }: { id: string; ex: SessionExercise; isCurrent: boolean; onStart: () => void }) {
  const c = ex.planned.circuit!;
  const done = ex.sets.every((x) => x.done);
  const labels = circuitLabels(c.keys);
  const minutes = Math.round((c.rounds * c.keys.length * (c.work + c.rest)) / 60);
  return (
    <section id={id} className={isCurrent ? 'hero col' : 'card col'} style={{ gap: 12, scrollMarginTop: 16 }}>
      {isCurrent && <HeroLeaves />}
      <div className="row between">
        <div className="col" style={{ gap: 4 }}>
          <span className={'muscle ' + (isCurrent ? '' : 'tint-violet')} style={isCurrent ? { background: 'rgba(255,255,255,0.16)', color: '#fff' } : undefined}>
            Abdos
          </span>
          <span style={{ fontSize: 19, fontWeight: 700 }}>
            Circuit abdos{c.number ? ` n°${c.number}` : ''} · {minutes} min
          </span>
          <span className={'small ' + (isCurrent ? 'on-hero-2' : 'muted')}>
            {c.rounds} tours · {c.work} s d’effort, {c.rest} s de repos
          </span>
        </div>
        {done && (
          <span className="badge">
            <Icon name="check" size={14} stroke={2.6} />
            Fait
          </span>
        )}
      </div>
      <div className="col" style={{ gap: 6 }}>
        {labels.map((l, i) => (
          <div key={i} className="row small" style={{ gap: 10 }}>
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: isCurrent ? 'rgba(255,255,255,0.16)' : 'var(--violet-tint)',
                color: isCurrent ? '#fff' : 'var(--violet-ink)',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontWeight: 600 }}>{l}</span>
          </div>
        ))}
      </div>
      <button className={isCurrent ? 'hero-btn press' : 'btn ghost press'} onClick={onStart}>
        <Icon name="timer" size={20} />
        {done ? 'Refaire le circuit' : 'Lancer le minuteur'}
      </button>
    </section>
  );
}

type Phase = { type: 'work' | 'rest'; key: string; label: string; i: number; r: number; dur: number };

function CircuitSheet({ circuit, onClose, onDone }: { circuit?: Circuit; onClose: () => void; onDone: () => void }) {
  const [startAt, setStartAt] = useState<number | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [skip, setSkip] = useState(0);
  const now = useNow(200);
  const last = useRef({ idx: -1, tick: -1, ended: false });

  const phases = useMemo<Phase[]>(() => {
    if (!circuit) return [];
    const labels = circuitLabels(circuit.keys);
    const out: Phase[] = [];
    for (let r = 0; r < circuit.rounds; r++)
      circuit.keys.forEach((k, i) => {
        out.push({ type: 'work', key: k, label: labels[i], i, r, dur: circuit.work });
        const isLast = r === circuit.rounds - 1 && i === circuit.keys.length - 1;
        if (!isLast && circuit.rest > 0) {
          const ni = (i + 1) % circuit.keys.length;
          out.push({ type: 'rest', key: circuit.keys[ni], label: labels[ni], i: ni, r: ni === 0 ? r + 1 : r, dur: circuit.rest });
        }
      });
    return out;
  }, [circuit]);

  useEffect(() => {
    if (!circuit) {
      setStartAt(null);
      setPausedAt(null);
      setSkip(0);
      last.current = { idx: -1, tick: -1, ended: false };
    }
  }, [circuit]);

  const total = phases.reduce((a, p) => a + p.dur, 0);
  const elapsed = startAt ? ((pausedAt ?? now) - startAt) / 1000 + skip : 0;
  let acc = 0;
  let idx = phases.length;
  for (let k = 0; k < phases.length; k++) {
    if (elapsed < acc + phases[k].dur) {
      idx = k;
      break;
    }
    acc += phases[k].dur;
  }
  const phase = phases[idx];
  const left = phase ? Math.ceil(acc + phase.dur - elapsed) : 0;
  const finished = startAt !== null && idx >= phases.length;

  useEffect(() => {
    if (!startAt || pausedAt) return;
    if (finished) {
      if (!last.current.ended) {
        last.current.ended = true;
        onDone();
      }
      return;
    }
    if (idx !== last.current.idx) {
      last.current.idx = idx;
      tone(phase.type === 'work' ? 'go' : 'rest');
    } else if (left <= 3 && left >= 1 && left !== last.current.tick) {
      last.current.tick = left;
      tone('tick');
    }
  }, [idx, left, startAt, pausedAt, finished]);

  function start() {
    unlockAudio();
    haptic();
    stopRest();
    setStartAt(Date.now());
    setPausedAt(null);
    setSkip(0);
    last.current = { idx: -1, tick: -1, ended: false };
  }

  function togglePause() {
    haptic();
    if (pausedAt) {
      setStartAt((s0) => (s0 ?? Date.now()) + (Date.now() - pausedAt));
      setPausedAt(null);
    } else setPausedAt(Date.now());
  }

  function next() {
    haptic();
    if (!phase) return;
    setSkip((x) => x + (acc + phase.dur - elapsed) + 0.01);
  }

  const work = phase?.type === 'work';
  const after = phases.slice(idx + 1).find((p) => p.type === 'work');

  return (
    <Sheet open={!!circuit} onClose={onClose} title="Circuit abdos" full>
      {circuit && (
        <div className="col" style={{ gap: 16 }}>
          {!startAt ? (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                {circuit.rounds} tours de {circuit.keys.length} exercices, {circuit.work} s d’effort et {circuit.rest} s de repos. Un bip annonce chaque changement, avec un compte à rebours 3, 2, 1. Monte le son.
              </p>
              <button className="btn brand press" onClick={start}>
                <Icon name="timer" />
                C’est parti ({Math.round(total / 60)} min)
              </button>
            </>
          ) : finished ? (
            <div className="hero col" style={{ gap: 10, alignItems: 'center', textAlign: 'center' }}>
              <HeroLeaves />
              <Icon name="trophy" size={40} />
              <span style={{ fontSize: 24, fontWeight: 700 }}>Circuit terminé</span>
            </div>
          ) : (
            <>
              <div className={work ? 'hero col' : 'card col'} style={{ gap: 10, alignItems: 'center', textAlign: 'center', padding: 24, background: work ? undefined : 'var(--card2)', boxShadow: work ? undefined : 'none' }}>
                {work && <HeroLeaves />}
                <span className={work ? 'hero-chip' : 'badge gray'}>
                  {work ? 'Effort' : 'Repos'} · tour {phase.r + 1}/{circuit.rounds} · {phase.i + 1}/{circuit.keys.length}
                </span>
                <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{work ? phase.label : `Ensuite : ${phase.label}`}</span>
                <Ring
                  value={Math.max(0, (acc + phase.dur - elapsed) / phase.dur)}
                  size={180}
                  stroke={12}
                  color={work ? '#BEF264' : 'var(--brand)'}
                  track={work ? 'rgba(255,255,255,0.18)' : 'var(--track)'}
                >
                  <span style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>{left}</span>
                  <span className={'small ' + (work ? 'on-hero-2' : 'muted')}>secondes</span>
                </Ring>
                {work && after && <span className="small on-hero-2">Puis : {after.label}</span>}
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn ghost press grow" onClick={togglePause}>
                  {pausedAt ? 'Reprendre' : 'Pause'}
                </button>
                <button className="btn ghost press grow" onClick={next}>
                  Passer
                </button>
              </div>
              <div className="progress-line">
                <div style={{ width: Math.min(100, (elapsed / total) * 100) + '%' }} />
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ---------------- Forme du jour ----------------
function ReadinessSheet({ day, onClose, onPick }: { day: ProgramDay | null; onClose: () => void; onPick: (r: Readiness) => void }) {
  const [sleep, setSleep] = useState(1);
  const [energy, setEnergy] = useState(1);
  useEffect(() => {
    setSleep(1);
    setEnergy(1);
  }, [day?.id]);
  const score = (Math.min(5, Math.max(1, sleep + energy + 1)) as Readiness);
  const msg = [
    '',
    'Grosse fatigue : une série de moins et −10 % sur les charges.',
    'Un peu fatigué : −5 % sur les charges.',
    'Forme normale : séance prévue.',
    'En forme : séance prévue, donne tout.',
    'Au top : on tente un peu plus lourd sur le premier gros exercice.',
  ][score];
  const row = (label: string, value: number, set: (v: number) => void, opts: string[]) => (
    <div className="col" style={{ gap: 6 }}>
      <span className="small muted" style={{ fontWeight: 600 }}>
        {label}
      </span>
      <div className="segmented" role="group" aria-label={label}>
        {opts.map((o, i) => (
          <button key={o} aria-pressed={value === i} onClick={() => set(i)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
  // grosse activité la veille : on prévient pour les jambes
  const yesterday = activitiesOn(addDays(dayKey(), -1)).find((a) => ['course', 'circuit'].includes(a.data.type) && (a.data.rpe ?? 2) >= 2);
  const legs = day?.exercises.some((e) => CATALOG[e.key]?.lower);
  return (
    <Sheet open={!!day} onClose={onClose} title="Ta forme du jour">
      {yesterday && (
        <div className="card row small" style={{ background: 'var(--orange-tint)', boxShadow: 'none', color: 'var(--orange-ink)', gap: 8 }}>
          <Icon name="run" size={18} />
          Hier : {ACTIVITY[yesterday.data.type].label.toLowerCase()} ({activityLine(yesterday.data)}).{legs ? ' Si tes jambes sont lourdes, mets une énergie plus faible : je baisserai les charges.' : ''}
        </div>
      )}
      {row('Ton sommeil cette nuit', sleep, setSleep, ['Mauvais', 'Moyen', 'Bon'])}
      {row('Ton énergie ce matin', energy, setEnergy, ['Faible', 'Normale', 'Haute'])}
      <div className="card row small" style={{ background: score <= 2 ? 'var(--amber-tint)' : score === 5 ? 'var(--brand-tint)' : 'var(--card2)', boxShadow: 'none', color: score <= 2 ? 'var(--amber-ink)' : score === 5 ? 'var(--brand-deep)' : 'var(--ink)' }}>
        <Icon name="heart" size={18} />
        {msg}
      </div>
      <button className="btn brand press" onClick={() => onPick(score)}>
        <Icon name="dumbbell" />
        Commencer
      </button>
    </Sheet>
  );
}
