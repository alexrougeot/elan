import { useEffect, useMemo, useState } from 'react';
import type { Tab } from '../App';
import { getData, getDoc, putDoc, removeDoc, useStoreVersion } from '../lib/store';
import { dayKey, fmtNum, fmtWeight, shortDate, WEEKDAYS } from '../lib/dates';
import { CATALOG, estimateMinutes, exName, platesFor, type Program, type ProgramDay } from '../lib/program';
import { bestE1rm, e1rm, historyFor, prepareExercise, sessions, type Session, type SessionExercise } from '../lib/coach';
import { activeSession, adjustRest, getProgram, planFor, sessionRecords, sessionStats, setRestSound, startRest, startSession, stopRest, updateSession, useRest } from '../lib/workout';
import { haptic, keepScreenOn, unlockAudio } from '../lib/device';
import { Icon, Ring, Sheet, Stepper, showToast, useNow } from '../components/ui';

export default function Workout({ go }: { go: (t: Tab) => void }) {
  useStoreVersion();
  const active = activeSession();
  if (active) return <SessionView id={active.id} />;
  return <Planner go={go} />;
}

// ---------------- Choisir une séance ----------------
function Planner({ go }: { go: (t: Tab) => void }) {
  const program = getProgram();
  const plan = planFor(program);
  const today = dayKey();
  const history = sessions().filter((s) => s.data.endedAt).slice(0, 12);
  const doneToday = history.find((s) => s.data.date === today);
  const [busy, setBusy] = useState(false);

  async function start(day: ProgramDay) {
    if (!program || busy) return;
    setBusy(true);
    unlockAudio();
    haptic();
    await startSession(day, program);
    setBusy(false);
  }

  return (
    <main className="screen">
      <header className="screen-head">
        <h1 className="title">Séance</h1>
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
            <section className="card col" style={{ gap: 14 }}>
              <div className="row between">
                <div className="col" style={{ gap: 2 }}>
                  <span className="tiny muted" style={{ fontWeight: 500 }}>
                    Aujourd’hui
                  </span>
                  <h2 className="h2" style={{ fontSize: 22 }}>
                    {plan.title}
                    {plan.subtitle ? ' · ' + plan.subtitle : ''}
                  </h2>
                </div>
                <span className="badge gray">{estimateMinutes(plan)} min</span>
              </div>
              <div className="col" style={{ gap: 6 }}>
                {plan.exercises.map((e, i) => (
                  <div key={i} className="row between small">
                    <span style={{ fontWeight: 600 }}>{exName(e.key)}</span>
                    <span className="muted">
                      {e.sets} × {e.min === e.max ? e.min : `${e.min}-${e.max}`}
                      {CATALOG[e.key]?.timed ? ' s' : ''}
                    </span>
                  </div>
                ))}
              </div>
              <button className="btn brand press" onClick={() => start(plan)} disabled={busy}>
                <Icon name="dumbbell" />
                {doneToday ? 'Refaire cette séance' : 'Commencer la séance'}
              </button>
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

      {history.length > 0 && (
        <>
          <div className="section-head">
            <h2 className="h2">Dernières séances</h2>
          </div>
          <div className="card tight">
            {history.map((s, i) => {
              const st = sessionStats(s.data);
              const min = s.data.endedAt ? Math.round((new Date(s.data.endedAt).getTime() - new Date(s.data.startedAt).getTime()) / 60000) : 0;
              return (
                <div key={s.id}>
                  <div className="list-row">
                    <div className="grow col" style={{ gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{s.data.title}</span>
                      <span className="small muted">
                        {shortDate(s.data.date)} · {min} min · {st.sets} séries · {fmtNum(st.volume)} kg soulevés
                      </span>
                    </div>
                  </div>
                  {i < history.length - 1 && <div className="divider" />}
                </div>
              );
            })}
          </div>
        </>
      )}
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

  useEffect(() => {
    void keepScreenOn(true);
    const st = getData<{ sound?: boolean }>('settings');
    setRestSound(st?.sound !== false);
    return () => void keepScreenOn(false);
  }, []);

  if (!s) return null;
  const current =s.exercises.findIndex((e) => e.sets.some((x) => !x.done));
  const elapsed = Math.max(0, Math.floor((now - new Date(s.startedAt).getTime()) / 1000));
  const totalSets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = s.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);

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
    if (prev > 0 && v > Math.max(prev, inSession) && !CATALOG[ex.key]?.timed) {
      showToast(`Nouveau record sur ${exName(ex.key)} : ${fmtWeight(set.w)} kg × ${set.r}`, undefined, 4500);
    }
    await updateSession(id, (x) => {
      x.exercises[ei].sets[sj].done = true;
      x.exercises[ei].sets[sj].at = new Date().toISOString();
      return x;
    });
    const after = getDoc<Session>(id)!.data;
    const nextEi = after.exercises.findIndex((e) => e.sets.some((y) => !y.done));
    if (nextEi < 0) {
      stopRest();
      setFinish(true);
      return;
    }
    const label = nextEi === ei ? `Série ${sj + 2} · ${exName(ex.key)}` : `Prochain : ${exName(after.exercises[nextEi].key)}`;
    startRest(ex.planned.rest, label);
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

      {s.deload && (
        <div className="card row" style={{ background: 'var(--amber-tint)', boxShadow: 'none' }}>
          <Icon name="info" style={{ color: 'var(--amber-ink)' }} />
          <span className="small" style={{ color: 'var(--amber-ink)' }}>
            Semaine légère : garde 2 ou 3 reps en réserve sur chaque série.
          </span>
        </div>
      )}

      {s.exercises.map((ex, ei) => (
        <ExerciseCard
          key={ei + ex.key}
          sid={id}
          ex={ex}
          isCurrent={ei === current}
          open={expanded[ei] ?? ei === current}
          onToggle={() => setExpanded((m) => ({ ...m, [ei]: !(m[ei] ?? ei === current) }))}
          onEdit={(sj) => setEdit({ ei, sj })}
          onValidate={(sj) => validate(ei, sj)}
          onAddSet={() => addSet(ei)}
          onRemoveSet={() => removeSet(ei)}
          onReplace={() => setReplace(ei)}
          onPlates={() => setPlates(ei)}
        />
      ))}

      {rest && <RestBar />}

      <SetEditor sid={id} session={s} edit={edit} onClose={() => setEdit(null)} />
      <ReplaceSheet sid={id} session={s} index={replace} onClose={() => setReplace(null)} />
      <PlatesSheet session={s} index={plates} onClose={() => setPlates(null)} />
      <FinishSheet sid={id} session={s} open={finish} onClose={() => setFinish(false)} />
    </main>
  );
}

function ExerciseCard({
  sid,
  ex,
  isCurrent,
  open,
  onToggle,
  onEdit,
  onValidate,
  onAddSet,
  onRemoveSet,
  onReplace,
  onPlates,
}: {
  sid: string;
  ex: SessionExercise;
  isCurrent: boolean;
  open: boolean;
  onToggle: () => void;
  onEdit: (sj: number) => void;
  onValidate: (sj: number) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onReplace: () => void;
  onPlates: () => void;
}) {
  const def = CATALOG[ex.key];
  const timed = !!def?.timed;
  const last = useMemo(() => historyFor(ex.key, sid)[0], [ex.key, sid]);
  const allDone = ex.sets.every((x) => x.done);
  const firstOpen = ex.sets.findIndex((x) => !x.done);
  const range = ex.planned.min === ex.planned.max ? `${ex.planned.min}` : `${ex.planned.min}-${ex.planned.max}`;
  const restTxt = ex.planned.rest >= 60 ? `${Math.floor(ex.planned.rest / 60)} min${ex.planned.rest % 60 ? ' ' + (ex.planned.rest % 60) : ''}` : `${ex.planned.rest} s`;
  const tipColor = ex.tip.kind === 'up' ? 'var(--brand-deep)' : ex.tip.kind === 'down' || ex.tip.kind === 'deload' ? 'var(--amber-ink)' : 'var(--ink)';
  const tipBg = ex.tip.kind === 'up' ? 'var(--brand-tint)' : ex.tip.kind === 'down' || ex.tip.kind === 'deload' ? 'var(--amber-tint)' : 'var(--line2)';

  return (
    <section className="card col" style={{ gap: 12, boxShadow: isCurrent ? 'var(--shadow), inset 0 0 0 1.5px color-mix(in srgb, var(--brand) 40%, transparent)' : undefined }}>
      <button className="row" style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', minHeight: 44 }} onClick={onToggle} aria-expanded={open}>
        <div className="grow col" style={{ gap: 2 }}>
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.015em' }}>{exName(ex.key)}</span>
          <span className="small muted">
            {ex.sets.length} × {range}
            {timed ? ' s' : ' reps'} · repos {restTxt}
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

          <div className="col" style={{ gap: 6 }}>
            <div className="set-row tiny muted" style={{ minHeight: 18, fontWeight: 600 }}>
              <span>Série</span>
              <span>{timed ? '' : 'Charge'}</span>
              <span>{timed ? 'Durée' : 'Reps'}</span>
              <span />
            </div>
            {ex.sets.map((x, sj) => {
              const active = isCurrent && sj === firstOpen;
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
            {(def?.alternatives.length ?? 0) > 0 && (
              <button className="chip press" onClick={onReplace}>
                <Icon name="swap" size={16} />
                Remplacer
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
    const alt = def.alternatives.map((k) => CATALOG[k]).filter(Boolean);
    const same = Object.values(CATALOG).filter((c) => c.muscle === def.muscle && c.key !== def.key && !def.alternatives.includes(c.key));
    return [...alt, ...same];
  }, [def?.key]);

  async function pick(key: string) {
    if (index === null || !ex) return;
    haptic();
    const prepared = prepareExercise({ ...ex.planned, key }, !!session.deload, sid);
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
    <Sheet open={index !== null} onClose={onClose} title="Remplacer l’exercice">
      {ex && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            Machine prise ou matériel absent ? Choisis un exercice qui travaille les mêmes muscles ({def?.muscle.toLowerCase()}).
          </p>
          <div className="card tight" style={{ boxShadow: 'none', background: 'var(--card2)' }}>
            {options.map((o) => (
              <button key={o.key} className="list-row press" onClick={() => pick(o.key)}>
                <div className="grow col" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{o.name}</span>
                  <span className="small muted">{o.equipment}</span>
                </div>
                <Icon name="right" style={{ color: 'var(--ink3)' }} />
              </button>
            ))}
          </div>
          <label className="row small" style={{ gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={inProgram} onChange={(e) => setInProgram(e.target.checked)} style={{ width: 22, minHeight: 22, accentColor: 'var(--brand-ink)' }} />
            Le remplacer aussi dans mon programme
          </label>
        </>
      )}
    </Sheet>
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
