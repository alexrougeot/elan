import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { closeStore, getData, putDoc, useStoreVersion } from '../lib/store';
import { lastSyncAt, syncNow, useSyncStatus } from '../lib/sync';
import { dayKey, hhmm, WEEKDAYS } from '../lib/dates';
import { computeTargets, GOALS, kcalOf, mealTarget, type Goal, type Meal, type Profile, type Targets } from '../lib/nutrition';
import { ABS, abs, CATALOG, defaultRest, exName, fullBodyProgram, programFor, upperLowerProgram, type Program, type ProgramDay } from '../lib/program';
import ProgramChooser from '../components/ProgramChooser';
import { currentSubscription, disablePush, enablePush, pushSupported } from '../lib/push';
import { isIOS, isStandalone } from '../lib/device';
import { createLink, getLink, linkUrl, runShortcut, SHORTCUT_NAME } from '../lib/health';
import { Icon, Sheet, showToast } from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';

export type SettingsStart = { page: 'program'; dayId?: string } | null;

export default function Settings({ open, onClose, start }: { open: boolean; onClose: () => void; start?: SettingsStart }) {
  useStoreVersion();
  const [page, setPage] = useState<'main' | 'profile' | 'nutrition' | 'program' | 'watch'>('main');
  useEffect(() => {
    if (open) setPage(start?.page ?? 'main');
  }, [open]);

  const titles = { main: 'Réglages', profile: 'Profil', nutrition: 'Objectifs et repas', program: 'Programme', watch: 'Montre et Santé' };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={titles[page]}
      full
      right={
        page !== 'main' ? (
          <button className="chip press" onClick={() => setPage('main')}>
            <Icon name="left" size={16} />
            Réglages
          </button>
        ) : undefined
      }
    >
      {page === 'main' && <MainPage go={setPage} />}
      {page === 'profile' && <ProfilePage />}
      {page === 'nutrition' && <NutritionPage />}
      {page === 'program' && <ProgramPage startDay={open ? start?.dayId : undefined} />}
      {page === 'watch' && <WatchPage />}
    </Sheet>
  );
}

function Row({ icon, title, sub, onClick }: { icon: string; title: string; sub?: string; onClick: () => void }) {
  return (
    <button className="list-row press" onClick={onClick}>
      <Icon name={icon} style={{ color: 'var(--brand-ink)' }} />
      <div className="grow col" style={{ gap: 1 }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {sub && <span className="small muted">{sub}</span>}
      </div>
      <Icon name="right" style={{ color: 'var(--ink3)' }} />
    </button>
  );
}

function MainPage({ go }: { go: (p: 'profile' | 'nutrition' | 'program' | 'watch') => void }) {
  const profile = getData<Profile>('profile')!;
  const targets = getData<Targets>('targets');
  const program = getData<Program>('program');
  const settings = getData<{ bar?: number; sound?: boolean }>('settings') ?? {};
  const sync = useSyncStatus();
  const [email, setEmail] = useState('');
  const [push, setPush] = useState<boolean | null>(null);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
    currentSubscription()
      .then((s) => setPush(!!s))
      .catch(() => setPush(false));
  }, []);

  async function togglePush() {
    if (push) {
      await disablePush();
      setPush(false);
      showToast('Rappels désactivés sur ce téléphone');
      return;
    }
    const r = await enablePush();
    if (r === 'ok') {
      setPush(true);
      showToast('Rappels de repas activés');
    } else if (r === 'denied') showToast('Notifications refusées. Autorise-les dans Réglages, Notifications, Élan.', undefined, 6000);
    else if (r === 'unsupported') showToast('Installe d’abord Élan sur l’écran d’accueil.', undefined, 6000);
    else showToast('Impossible pour l’instant. Réessaie avec du réseau.');
  }

  async function logout() {
    await syncNow();
    await supabase?.auth.signOut();
    closeStore();
  }

  const syncLabel = { idle: 'En attente', syncing: 'Synchronisation…', ok: 'À jour', offline: 'Hors ligne, en attente du réseau', error: 'Erreur, nouvel essai bientôt' }[sync];
  const last = lastSyncAt();

  return (
    <>
      <div className="card tight" style={{ background: 'var(--card2)', boxShadow: 'none' }}>
        <Row icon="user" title={profile.name} sub={`${GOALS[profile.goal]} · ${profile.weight} kg → ${profile.goalWeight} kg`} onClick={() => go('profile')} />
        <div className="divider" />
        <Row icon="fork" title="Objectifs et repas" sub={targets ? `${targets.kcal} kcal · ${targets.meals.length} repas · ${targets.mode === 'auto' ? 'ajustement auto' : 'manuel'}` : ''} onClick={() => go('nutrition')} />
        <div className="divider" />
        <Row icon="dumbbell" title="Programme" sub={program ? (program.days.length ? program.days.map((d) => WEEKDAYS[d.weekday].slice(0, 3).toLowerCase()).join(', ') + ` · ${program.days.length} séance${program.days.length > 1 ? 's' : ''}` : 'Aucune séance') : ''} onClick={() => go('program')} />
        <div className="divider" />
        <Row icon="timer" title="Montre et Santé" sub={getLink() ? 'Apple Watch ou Garmin reliée' : 'Courses avec parcours, calories et cœur'} onClick={() => go('watch')} />
      </div>

      <div className="card col" style={{ gap: 4, background: 'var(--card2)', boxShadow: 'none' }}>
        <div className="row between" style={{ minHeight: 48 }}>
          <div className="col" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>Rappels de repas</span>
            <span className="small muted">
              {!pushSupported() || (isIOS() && !isStandalone()) ? 'Installe Élan sur l’écran d’accueil pour les activer.' : push ? 'Activés sur ce téléphone' : 'Une notification à chaque repas'}
            </span>
          </div>
          <Toggle on={!!push} onChange={togglePush} label="Rappels de repas" disabled={!pushSupported() || (isIOS() && !isStandalone())} />
        </div>
        <div className="row between" style={{ minHeight: 48 }}>
          <div className="col" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>Son à la fin du repos</span>
            <span className="small muted">Pense à activer le son du téléphone.</span>
          </div>
          <Toggle on={settings.sound !== false} onChange={() => putDoc('settings', 'settings', { ...settings, sound: settings.sound === false })} label="Son à la fin du repos" />
        </div>
        <div className="col" style={{ gap: 6, padding: '8px 0' }}>
          <span style={{ fontWeight: 600 }}>Barre de musculation</span>
          <div className="segmented" role="group" aria-label="Poids de la barre">
            {[20, 15, 10].map((b) => (
              <button key={b} aria-pressed={(settings.bar ?? 20) === b} onClick={() => putDoc('settings', 'settings', { ...settings, bar: b })}>
                {b} kg
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
        <div className="row between">
          <div className="col" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>Synchronisation</span>
            <span className="small muted">
              {syncLabel}
              {last && sync === 'ok' ? ` · ${new Date(last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
          <button className="btn small ghost press" onClick={() => syncNow()}>
            Synchroniser
          </button>
        </div>
        <span className="small muted">Tout est d’abord enregistré sur ton téléphone : l’app marche sans réseau, puis se synchronise toute seule.</span>
      </div>

      {isIOS() && !isStandalone() && (
        <div className="card row small" style={{ alignItems: 'flex-start', background: 'var(--card2)', boxShadow: 'none' }}>
          <Icon name="share" style={{ color: 'var(--brand-ink)' }} />
          <span>
            Installe Élan : bouton <b>Partager</b> de Safari, puis <b>Sur l’écran d’accueil</b>.
          </span>
        </div>
      )}

      <div className="col" style={{ gap: 8 }}>
        <span className="small muted" style={{ textAlign: 'center' }}>
          Connecté avec {email || 'ton compte'}
        </span>
        <button className="btn ghost press" onClick={logout}>
          Se déconnecter
        </button>
        <span className="tiny muted" style={{ textAlign: 'center' }}>
          Version du {new Date(__BUILD__).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 52,
        height: 32,
        borderRadius: 16,
        border: 'none',
        background: on ? 'var(--brand)' : 'var(--line)',
        position: 'relative',
        flex: 'none',
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 200ms',
      }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 26, height: 26, borderRadius: 13, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 220ms cubic-bezier(0.2,0.8,0.2,1)' }} />
    </button>
  );
}

// ---------------- Profil ----------------
function ProfilePage() {
  const p = getData<Profile>('profile')!;
  const [name, setName] = useState(p.name);
  const [age, setAge] = useState(String(p.age));
  const [height, setHeight] = useState(String(p.height));
  const [goal, setGoal] = useState<Goal>(p.goal);
  const [goalWeight, setGoalWeight] = useState(String(p.goalWeight));
  const [activity, setActivity] = useState(p.activity);
  const n = (s: string) => Number(s.replace(',', '.'));

  async function save(recalc: boolean) {
    const next: Profile = { ...p, name: name.trim() || p.name, age: n(age) || p.age, height: n(height) || p.height, goal, goalWeight: n(goalWeight) || p.goalWeight, activity };
    await putDoc('profile', 'profile', next);
    if (recalc) {
      const t = getData<Targets>('targets');
      const w = getData<{ kg: number }>('weight:' + dayKey())?.kg ?? p.weight;
      const calc = computeTargets({ ...next, weight: w });
      if (t) await putDoc('targets', 'targets', { ...t, ...calc });
    }
    showToast(recalc ? 'Profil et objectifs mis à jour' : 'Profil enregistré');
  }

  return (
    <>
      <label className="field">
        <span>Prénom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="fields-2">
        <label className="field">
          <span>Âge</span>
          <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label className="field">
          <span>Taille (cm)</span>
          <input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span>Objectif</span>
        <div className="segmented" role="group" aria-label="Objectif">
          {(Object.keys(GOALS) as Goal[]).map((g) => (
            <button key={g} aria-pressed={goal === g} onClick={() => setGoal(g)}>
              {GOALS[g]}
            </button>
          ))}
        </div>
      </div>
      {goal !== 'maintien' && (
        <label className="field">
          <span>Poids visé (kg)</span>
          <input inputMode="decimal" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
        </label>
      )}
      <div className="field">
        <span>Activité</span>
        <div className="segmented" role="group" aria-label="Activité">
          {[
            [1.375, 'Peu actif'],
            [1.55, 'Actif'],
            [1.725, 'Très actif'],
          ].map(([v, l]) => (
            <button key={v} aria-pressed={activity === v} onClick={() => setActivity(v as number)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <button className="btn brand press" onClick={() => save(false)}>
        Enregistrer
      </button>
      <button className="btn ghost press" onClick={() => save(true)}>
        Enregistrer et recalculer mes calories
      </button>
    </>
  );
}

// ---------------- Objectifs et repas ----------------
function NutritionPage() {
  const t = getData<Targets>('targets')!;
  const [kcalP, setP] = useState(String(t.p));
  const [kcalG, setG] = useState(String(t.g));
  const [kcalL, setL] = useState(String(t.l));
  const n = (s: string) => Math.max(0, Math.round(Number(s.replace(',', '.')) || 0));

  useEffect(() => {
    setP(String(t.p));
    setG(String(t.g));
    setL(String(t.l));
  }, [t.p, t.g, t.l]);

  async function saveMacros() {
    const p = n(kcalP);
    const g = n(kcalG);
    const l = n(kcalL);
    await putDoc('targets', 'targets', { ...t, p, g, l, kcal: kcalOf({ p, g, l }) });
    showToast('Objectifs enregistrés');
  }

  async function setMeals(meals: Meal[]) {
    await putDoc('targets', 'targets', { ...t, meals });
  }

  function normalize(meals: Meal[]) {
    const tot = { p: 0, g: 0, l: 0 };
    for (const m of meals) {
      tot.p += m.share.p;
      tot.g += m.share.g;
      tot.l += m.share.l;
    }
    return meals.map((m) => ({ ...m, share: { p: m.share.p / (tot.p || 1), g: m.share.g / (tot.g || 1), l: m.share.l / (tot.l || 1) } }));
  }

  return (
    <>
      <div className="card col" style={{ gap: 12, background: 'var(--card2)', boxShadow: 'none' }}>
        <div className="row between">
          <div className="col" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>Ajustement automatique</span>
            <span className="small muted">Chaque lundi, selon ta moyenne de poids.</span>
          </div>
          <Toggle on={t.mode === 'auto'} onChange={() => putDoc('targets', 'targets', { ...t, mode: t.mode === 'auto' ? 'manuel' : 'auto' })} label="Ajustement automatique" />
        </div>
        <div className="big-num">{t.kcal} kcal</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <label className="field">
            <span>Protéines (g)</span>
            <input inputMode="numeric" value={kcalP} onChange={(e) => setP(e.target.value)} />
          </label>
          <label className="field">
            <span>Glucides (g)</span>
            <input inputMode="numeric" value={kcalG} onChange={(e) => setG(e.target.value)} />
          </label>
          <label className="field">
            <span>Lipides (g)</span>
            <input inputMode="numeric" value={kcalL} onChange={(e) => setL(e.target.value)} />
          </label>
        </div>
        <span className="small muted">Total : {kcalOf({ p: n(kcalP), g: n(kcalG), l: n(kcalL) })} kcal</span>
        <button className="btn small press" style={{ width: '100%' }} onClick={saveMacros}>
          Enregistrer les macros
        </button>
      </div>

      <div className="section-head">
        <h2 className="h2">Repas et heures des rappels</h2>
      </div>
      {t.meals.map((m, i) => {
        const tg = mealTarget(t, i);
        return (
          <div key={i} className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px', gap: 10 }}>
              <label className="field">
                <span>Nom</span>
                <input
                  defaultValue={m.name}
                  onBlur={(e) => {
                    const meals = [...t.meals];
                    meals[i] = { ...m, name: e.target.value.trim() || m.name };
                    void setMeals(meals);
                  }}
                />
              </label>
              <label className="field">
                <span>Heure</span>
                <input
                  type="time"
                  value={m.time}
                  onChange={(e) => {
                    const meals = [...t.meals];
                    meals[i] = { ...m, time: e.target.value || m.time };
                    void setMeals(meals);
                  }}
                />
              </label>
            </div>
            <div className="row between">
              <span className="small muted">
                {hhmm(m.time)} · {tg.k} kcal · P {tg.p} · G {tg.g} · L {tg.l}
              </span>
              {t.meals.length > 2 && (
                <button className="chip press" onClick={() => setMeals(normalize(t.meals.filter((_, j) => j !== i)))}>
                  Retirer
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button
        className="btn ghost press"
        onClick={() => {
          const scaled = t.meals.map((m) => ({ ...m, share: { p: m.share.p * 0.85, g: m.share.g * 0.85, l: m.share.l * 0.85 } }));
          void setMeals(normalize([...scaled, { name: 'Nouveau repas', time: '21:00', share: { p: 0.15, g: 0.15, l: 0.15 } }]).sort((a, b) => (a.time < b.time ? -1 : 1)));
        }}
      >
        <Icon name="plus" size={18} />
        Ajouter un repas
      </button>
    </>
  );
}

// ---------------- Programme ----------------
function ProgramPage({ startDay }: { startDay?: string }) {
  const program = getData<Program>('program')!;
  const [editing, setEditing] = useState<string | null>(startDay ?? null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [rebuild, setRebuild] = useState<{ count: number; days: number[] } | null>(null);
  const day = program.days.find((d) => d.id === editing);

  async function save(next: Program) {
    await putDoc('program', 'program', next);
  }

  function addDay() {
    const used = new Set(program.days.map((d) => d.weekday));
    const wd = [1, 2, 3, 4, 5, 6, 7].find((w) => !used.has(w)) ?? 1;
    const d: ProgramDay = { id: 'jour-' + Date.now().toString(36), weekday: wd, title: 'Nouvelle séance', subtitle: '', exercises: [] };
    void save({ ...program, days: [...program.days, d].sort((a, b) => a.weekday - b.weekday) });
    setEditing(d.id);
  }

  async function reset(kind: string) {
    const start = dayKey();
    await save(kind === 'ul' ? upperLowerProgram(start) : fullBodyProgram(start));
    setConfirmReset(null);
    showToast('Programme remplacé');
  }

  if (day) return <DayEditor program={program} day={day} onBack={() => setEditing(null)} onSave={save} />;

  return (
    <>
      <div className="card tight" style={{ background: 'var(--card2)', boxShadow: 'none' }}>
        {program.days.length === 0 && <div className="empty">Aucune séance pour l’instant.</div>}
        {program.days.map((d, i) => (
          <div key={d.id}>
            <button className="list-row press" onClick={() => setEditing(d.id)}>
              <span className="badge gray" style={{ width: 44, justifyContent: 'center' }}>
                {WEEKDAYS[d.weekday].slice(0, 3)}
              </span>
              <div className="grow col" style={{ gap: 1 }}>
                <span style={{ fontWeight: 600 }}>
                  {d.title}
                  {d.subtitle ? ' · ' + d.subtitle : ''}
                </span>
                <span className="small muted">{d.exercises.map((e) => exName(e.key)).join(', ') || 'Aucun exercice'}</span>
              </div>
              <Icon name="right" style={{ color: 'var(--ink3)' }} />
            </button>
            {i < program.days.length - 1 && <div className="divider" />}
          </div>
        ))}
      </div>
      <button className="btn ghost press" onClick={addDay}>
        <Icon name="plus" size={18} />
        Ajouter une séance
      </button>

      {program.extras.length > 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          À côté : {program.extras.map((x) => `${WEEKDAYS[x.weekday].toLowerCase()} (${x.title.toLowerCase()})`).join(', ')}. Ça ne compte pas comme une séance.
        </p>
      )}

      <div className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
        <span style={{ fontWeight: 600 }}>Semaine légère</span>
        <div className="segmented" role="group" aria-label="Semaine légère">
          {[0, 6, 7, 8].map((n) => (
            <button key={n} aria-pressed={program.deloadEvery === n} onClick={() => save({ ...program, deloadEvery: n })}>
              {n === 0 ? 'Jamais' : `Toutes les ${n} sem.`}
            </button>
          ))}
        </div>
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Changer le nombre de séances
        </span>
        {!rebuild ? (
          <button className="btn ghost press" onClick={() => setRebuild({ count: Math.min(5, Math.max(2, program.days.length || 3)), days: program.days.map((d) => d.weekday).slice(0, 5) })}>
            {program.days.length} séance{program.days.length > 1 ? 's' : ''} par semaine · modifier
          </button>
        ) : (
          <div className="card col" style={{ gap: 12, background: 'var(--card2)', boxShadow: 'none' }}>
            <ProgramChooser count={rebuild.count} days={rebuild.days} sex={getData<Profile>('profile')?.sex} onChange={(count, days) => setRebuild({ count, days })} />
            <span className="small muted">Ton programme est recréé pour ces jours, avec les exercices du programme type (tes changements d’exercices sont remplacés). Ton historique et tes charges restent : le coach reprend là où tu en es.</span>
            <button
              className="btn brand press"
              disabled={rebuild.days.length !== rebuild.count}
              onClick={async () => {
                await save(programFor(rebuild.count, rebuild.days, program.startDate, program.extras, getData<Profile>('profile')?.sex));
                setRebuild(null);
                showToast('Programme mis à jour');
              }}
            >
              Valider
            </button>
            <button className="btn ghost press" onClick={() => setRebuild(null)}>
              Annuler
            </button>
          </div>
        )}
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Repartir d’un programme type
        </span>
        {confirmReset ? (
          <>
            <span className="small">Ton programme actuel sera remplacé. Ton historique de séances reste intact.</span>
            <button className="btn danger press" onClick={() => reset(confirmReset)}>
              Remplacer mon programme
            </button>
            <button className="btn ghost press" onClick={() => setConfirmReset(null)}>
              Annuler
            </button>
          </>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost small press grow" onClick={() => setConfirmReset('ul')}>
              Haut / bas · 4
            </button>
            <button className="btn ghost small press grow" onClick={() => setConfirmReset('fb')}>
              Full body · 3
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function DayEditor({ program, day, onBack, onSave }: { program: Program; day: ProgramDay; onBack: () => void; onSave: (p: Program) => Promise<void> }) {
  const [picking, setPicking] = useState(false);
  const [swap, setSwap] = useState<number | null>(null);

  function update(fn: (d: ProgramDay) => ProgramDay) {
    const next = { ...program, days: program.days.map((d) => (d.id === day.id ? fn(structuredClone(d)) : d)).sort((a, b) => a.weekday - b.weekday) };
    void onSave(next);
  }

  function add(key: string) {
    const c = CATALOG[key];
    update((d) => {
      const planned = { key, sets: 3, min: c?.timed ? 30 : 8, max: c?.timed ? 45 : 12, rest: defaultRest(key) };
      const at = d.exercises.findIndex((e) => e.circuit);
      d.exercises.splice(at >= 0 ? at : d.exercises.length, 0, planned);
      return d;
    });
    setPicking(false);
    showToast(`${exName(key)} ajouté`);
  }

  function replace(key: string) {
    if (swap === null) return;
    const old = day.exercises[swap];
    update((d) => {
      d.exercises[swap] = { ...d.exercises[swap], key };
      return d;
    });
    setSwap(null);
    showToast(`${exName(old.key)} remplacé par ${exName(key)}`);
  }

  return (
    <>
      <button className="chip press" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
        <Icon name="left" size={16} />
        Toutes les séances
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="field">
          <span>Nom</span>
          <input defaultValue={day.title} onBlur={(e) => update((d) => ({ ...d, title: e.target.value.trim() || d.title }))} />
        </label>
        <label className="field">
          <span>Précision</span>
          <input defaultValue={day.subtitle} placeholder="lourd, volume…" onBlur={(e) => update((d) => ({ ...d, subtitle: e.target.value.trim() }))} />
        </label>
      </div>
      <label className="field">
        <span>Jour</span>
        <select value={day.weekday} onChange={(e) => update((d) => ({ ...d, weekday: Number(e.target.value) }))}>
          {[1, 2, 3, 4, 5, 6, 7].map((w) => (
            <option key={w} value={w}>
              {WEEKDAYS[w]}
            </option>
          ))}
        </select>
      </label>

      {day.exercises.map((e, i) => (
        <div key={i + e.key} className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
          <div className="row between">
            <span style={{ fontWeight: 700 }}>{exName(e.key)}</span>
            <div className="row" style={{ gap: 4 }}>
              {!e.circuit && (
                <button className="icon-btn plain press" aria-label={`Changer ${exName(e.key)}`} onClick={() => setSwap(i)}>
                  <Icon name="swap" size={18} />
                </button>
              )}
              <button className="icon-btn plain press" aria-label="Monter" disabled={i === 0} onClick={() => update((d) => ([d.exercises[i - 1], d.exercises[i]] = [d.exercises[i], d.exercises[i - 1]], d))}>
                <Icon name="up" size={18} />
              </button>
              <button
                className="icon-btn plain press"
                aria-label="Descendre"
                disabled={i === day.exercises.length - 1}
                onClick={() => update((d) => ([d.exercises[i + 1], d.exercises[i]] = [d.exercises[i], d.exercises[i + 1]], d))}
              >
                <Icon name="arrowDown" size={18} />
              </button>
              <button className="icon-btn plain press" aria-label="Retirer" onClick={() => update((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          </div>
          {e.group && <span className="muscle tint-violet" style={{ alignSelf: 'flex-start' }}>Superset {e.group}</span>}
          {e.circuit ? (
            <span className="small muted">
              {e.circuit.rounds} tours · {e.circuit.work} s / {e.circuit.rest} s : {e.circuit.keys.map((k) => exName(k)).join(', ')}
            </span>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {(
              [
                ['sets', 'Séries'],
                ['min', CATALOG[e.key]?.timed ? 'Min (s)' : 'Reps min'],
                ['max', CATALOG[e.key]?.timed ? 'Max (s)' : 'Reps max'],
                ['rest', 'Repos (s)'],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="field">
                <span>{l}</span>
                <input
                  inputMode="numeric"
                  defaultValue={e[k]}
                  onBlur={(ev) => {
                    const v = Math.max(1, Math.round(Number(ev.target.value) || e[k]));
                    update((d) => {
                      d.exercises[i] = { ...d.exercises[i], [k]: v };
                      if (d.exercises[i].min > d.exercises[i].max) d.exercises[i].max = d.exercises[i].min;
                      return d;
                    });
                  }}
                />
              </label>
            ))}
          </div>
          )}
        </div>
      ))}

      <button className="btn ghost press" onClick={() => setPicking(true)}>
        <Icon name="plus" size={18} />
        Ajouter un exercice
      </button>
      {!day.exercises.some((e) => e.circuit) && (
        <button className="btn ghost press" onClick={() => update((d) => ({ ...d, exercises: [...d.exercises, abs(ABS.a)] }))}>
          <Icon name="timer" size={18} />
          Ajouter 10 min d’abdos à la fin
        </button>
      )}
      <button
        className="btn danger press"
        onClick={() => {
          void onSave({ ...program, days: program.days.filter((d) => d.id !== day.id) });
          onBack();
        }}
      >
        Supprimer cette séance
      </button>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={add} />
      <ExercisePicker
        open={swap !== null}
        onClose={() => setSwap(null)}
        onPick={replace}
        title={swap !== null ? `Changer : ${exName(day.exercises[swap]?.key ?? '')}` : 'Changer'}
        first={
          swap !== null && CATALOG[day.exercises[swap]?.key]
            ? { label: 'Pour les mêmes muscles', keys: Object.values(CATALOG).filter((c) => c.muscle === CATALOG[day.exercises[swap].key].muscle && c.key !== day.exercises[swap].key && !c.circuit).map((c) => c.key).slice(0, 8) }
            : undefined
        }
      />
    </>
  );
}

// ---------------- Montre et Santé ----------------
function WatchPage() {
  const link = getLink();
  const [busy, setBusy] = useState(false);
  const url = link ? linkUrl(link.token) : '';

  async function make() {
    setBusy(true);
    try {
      await createLink();
      showToast('Ton lien est prêt');
    } catch {
      showToast('Impossible de créer le lien : vérifie ta connexion.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Adresse copiée');
    } catch {
      showToast('Copie impossible : sélectionne l’adresse à la main.');
    }
  }

  const step = (n: number, body: React.ReactNode) => (
    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      <span className="tile sm tint-brand" style={{ fontWeight: 700, fontSize: 14 }}>
        {n}
      </span>
      <div className="grow small" style={{ lineHeight: 1.5, paddingTop: 7 }}>
        {body}
      </div>
    </div>
  );

  return (
    <>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Ta montre enregistre tout dans l’app Santé de l’iPhone. Une app passerelle envoie chaque entraînement à Élan : tes courses arrivent avec le parcours, l’allure et le cœur, et tes séances de muscu avec leurs calories.
      </p>

      {!link ? (
        <button className="btn brand press" onClick={make} disabled={busy}>
          {busy ? 'Création…' : 'Créer mon lien personnel'}
        </button>
      ) : (
        <div className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
          <span style={{ fontWeight: 700 }}>Ton adresse personnelle</span>
          <code style={{ fontSize: 12, wordBreak: 'break-all', background: 'var(--card)', padding: 10, borderRadius: 10, userSelect: 'all' }}>{url}</code>
          <span className="tiny muted">Garde-la pour toi : elle permet d’ajouter des données à ton compte.</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn small brand press grow" onClick={copy}>
              Copier l’adresse
            </button>
            <button className="btn small ghost press" onClick={make} disabled={busy}>
              Recréer
            </button>
          </div>
        </div>
      )}

      <div className="section-head">
        <h2 className="h2">Health Auto Export (recommandé)</h2>
      </div>
      <div className="col" style={{ gap: 12 }}>
        {step(1, <>Installe <b>Health Auto Export</b> depuis l’App Store. L’envoi automatique demande la version Premium (achat unique, ou abonnement). Il y a un essai gratuit de 7 jours pour tester.</>)}
        {step(2, <>Au premier lancement, autorise l’accès à Santé, au moins : <b>entraînements</b>, <b>parcours d’entraînement</b>, <b>fréquence cardiaque</b>, <b>énergie active</b> et <b>distance</b>.</>)}
        {step(3, <>Ouvre l’onglet <b>Automations</b> et crée une automatisation de type <b>REST API</b>.</>)}
        {step(4, <>Dans <b>URL</b>, colle ton adresse personnelle (au-dessus).</>)}
        {step(5, <>Type de données : <b>Workouts</b> (entraînements). Active l’option qui inclut le <b>parcours</b> (route) et choisis le format <b>JSON</b>.</>)}
        {step(6, <>Période : depuis la dernière synchronisation. Fréquence : la plus courte proposée. Active l’automatisation.</>)}
        {step(7, <>Fais une course de test, puis touche <b>Course</b> sur l’accueil d’Élan : elle s’affiche avec sa carte. Les séances de muscu, elles, se rangent toutes seules avec la séance du jour.</>)}
      </div>
      <p className="tiny muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Garmin : dans Garmin Connect, autorise le partage des activités avec Santé. Selon les modèles, le parcours n’est pas toujours partagé.
      </p>

      <details className="card" style={{ background: 'var(--card2)', boxShadow: 'none' }}>
        <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Sans Health Auto Export : le raccourci gratuit</summary>
        <p className="small muted" style={{ lineHeight: 1.5 }}>
          Il envoie les calories et le cœur de ta séance de muscu. Il ne sait pas lire les courses ni leur parcours.
        </p>
      <div className="col" style={{ gap: 12 }}>
        {step(1, <>Ouvre l’app <b>Raccourcis</b>, touche <b>+</b> et nomme le raccourci <b>{SHORTCUT_NAME}</b> (exactement).</>)}
        {step(2, <>Ajoute l’action <b>Obtenir le contenu de l’URL</b> et colle ton adresse.</>)}
        {step(3, <>Ajoute <b>Obtenir la valeur du dictionnaire</b>, avec la clé <b>minutes</b>.</>)}
        {step(4, <>Ajoute <b>Rechercher des échantillons de santé</b> : type <b>Énergie active</b>, puis le filtre <b>Date de début</b> « est dans les derniers » <b>Valeur du dictionnaire</b> minutes. Retire la limite s’il y en a une.</>)}
        {step(5, <>Ajoute <b>Calculer des statistiques</b> (tape « statistiques » dans la recherche) et choisis <b>Somme</b>.</>)}
        {step(6, <>Ajoute de nouveau <b>Rechercher des échantillons de santé</b> : type <b>Fréquence cardiaque</b>, même filtre de date.</>)}
        {step(7, <>Ajoute <b>Calculer des statistiques</b> sur ces échantillons, choisis <b>Moyenne</b>. Puis une deuxième fois avec <b>Maximum</b>.</>)}
        {step(8, <>Ajoute enfin <b>Obtenir le contenu de l’URL</b> avec ton adresse. Touche la flèche : méthode <b>POST</b>, corps <b>JSON</b>, et ajoute quatre champs : <b>kcal</b> = la Somme, <b>fcMoy</b> = la Moyenne, <b>fcMax</b> = le Maximum, <b>source</b> = Apple Watch (ou Garmin).</>)}
        {step(9, <>Facultatif : ajoute <b>Afficher la notification</b> avec le <b>Contenu de l’URL</b>, pour voir la confirmation d’Élan.</>)}
      </div>

      <div className="section-head">
        <h2 className="h2">Le lancer tout seul</h2>
      </div>
      <div className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
        <span className="small" style={{ lineHeight: 1.5 }}>
          <b>Apple Watch :</b> dans Raccourcis, onglet <b>Automatisation</b>, crée une automatisation <b>Entraînement Apple Watch</b>, choisis <b>Se termine</b>, puis <b>Exécuter immédiatement</b> et le raccourci <b>{SHORTCUT_NAME}</b>. À chaque fin d’entraînement sur ta montre, Élan reçoit tes données.
        </span>
        <span className="small" style={{ lineHeight: 1.5 }}>
          <b>Garmin :</b> dans Garmin Connect, va dans les réglages, <b>Applications connectées</b>, <b>Santé Apple</b>, et autorise le partage des activités. Après la synchronisation de ta montre, touche <b>Récupérer depuis ma montre</b> sur l’accueil d’Élan.
        </span>
      </div>

      {link && (
        <button className="btn ghost press" onClick={runShortcut}>
          Tester le raccourci maintenant
        </button>
      )}
      </details>
      <p className="tiny muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Au premier lancement, l’iPhone te demande d’autoriser Raccourcis à lire Santé : accepte l’énergie active et la fréquence cardiaque. Ta femme crée son propre lien depuis son compte.
      </p>
    </>
  );
}
