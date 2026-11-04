import { useMemo, useState } from 'react';
import { putDoc } from '../lib/store';
import { dayKey, fmtNum, hhmm } from '../lib/dates';
import { computeTargets, defaultMeals, GOALS, kcalOf, type Goal, type Profile, type Sex, type Targets } from '../lib/nutrition';
import { emptyProgram, fullBodyProgram, upperLowerProgram } from '../lib/program';
import { Icon, LogoMark } from '../components/ui';

const ACTIVITY = [
  { v: 1.375, label: 'Peu actif', hint: '1 ou 2 séances par semaine' },
  { v: 1.55, label: 'Actif', hint: '3 à 5 séances par semaine' },
  { v: 1.725, label: 'Très actif', hint: '6 séances ou un métier physique' },
];

const PROGRAMS = [
  { id: 'ul', label: 'Haut / bas · 4 séances', hint: 'Lundi, mercredi, jeudi, vendredi matin. Chaque muscle 2 fois par semaine.' },
  { id: 'fb', label: 'Full body · 3 séances', hint: 'Lundi, mercredi, vendredi. Tout le corps à chaque séance.' },
  { id: 'none', label: 'Je compose le mien', hint: 'Tu ajoutes tes jours et tes exercices dans les réglages.' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('h');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<Goal>('masse');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState(1.55);
  const [program, setProgram] = useState('ul');
  const [saving, setSaving] = useState(false);

  const num = (s: string) => Number(s.replace(',', '.'));
  const profile: Profile = {
    name: name.trim(),
    sex,
    age: num(age),
    height: num(height),
    weight: num(weight),
    goal,
    goalWeight: num(goalWeight) || num(weight),
    activity,
    createdAt: new Date().toISOString(),
  };
  const targets = useMemo(() => (profile.age && profile.height && profile.weight ? computeTargets(profile) : null), [sex, age, height, weight, goal, activity]);

  const canNext = [
    profile.name.length > 0,
    profile.age > 10 && profile.age < 100 && profile.height > 120 && profile.height < 230 && profile.weight > 30 && profile.weight < 250,
    goal === 'maintien' || (profile.goalWeight > 30 && profile.goalWeight < 250),
    true,
    true,
  ][step];

  async function finish() {
    if (!targets) return;
    setSaving(true);
    const today = dayKey();
    const t: Targets = { ...targets, meals: defaultMeals(), mode: 'auto', history: [] };
    await putDoc('targets', 'targets', t);
    const prog = program === 'ul' ? upperLowerProgram(today) : program === 'fb' ? fullBodyProgram(today) : emptyProgram(today);
    await putDoc('program', 'program', prog);
    await putDoc('weight:' + today, 'weight', { date: today, kg: profile.weight });
    await putDoc('settings', 'settings', { bar: 20, sound: true });
    await putDoc('profile', 'profile', profile);
  }

  const steps = ['Toi', 'Mensurations', 'Objectif', 'Programme', 'Ton plan'];

  return (
    <main className="app" style={{ padding: 'calc(var(--safe-t) + 24px) 20px calc(var(--safe-b) + 24px)', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="row between">
        {step > 0 ? (
          <button className="icon-btn press" aria-label="Retour" onClick={() => setStep(step - 1)}>
            <Icon name="left" />
          </button>
        ) : (
          <LogoMark size={44} />
        )}
        <span className="small muted">
          {step + 1} sur {steps.length}
        </span>
      </div>
      <div className="bar" aria-hidden="true">
        <div style={{ width: ((step + 1) / steps.length) * 100 + '%', background: 'var(--brand)' }} />
      </div>

      {step === 0 && (
        <section className="col" style={{ gap: 18 }}>
          <h1 className="title">Bienvenue sur Élan</h1>
          <p className="muted" style={{ margin: 0 }}>
            Quelques questions pour calculer tes calories, tes macros et préparer tes séances.
          </p>
          <label className="field">
            <span>Ton prénom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </label>
          <div className="field">
            <span>Tu es</span>
            <div className="segmented" role="group" aria-label="Sexe">
              <button type="button" aria-pressed={sex === 'h'} onClick={() => setSex('h')}>
                Un homme
              </button>
              <button type="button" aria-pressed={sex === 'f'} onClick={() => setSex('f')}>
                Une femme
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="col" style={{ gap: 18 }}>
          <h1 className="title">Tes mensurations</h1>
          <label className="field">
            <span>Âge</span>
            <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ans" />
          </label>
          <div className="fields-2">
            <label className="field">
              <span>Taille (cm)</span>
              <input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
            <label className="field">
              <span>Poids (kg)</span>
              <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="col" style={{ gap: 18 }}>
          <h1 className="title">Ton objectif</h1>
          <div className="col" style={{ gap: 8 }}>
            {(Object.keys(GOALS) as Goal[]).map((g) => (
              <button key={g} className={'chip press' + (goal === g ? ' on' : '')} style={{ minHeight: 50, justifyContent: 'flex-start', fontSize: 16 }} onClick={() => setGoal(g)} aria-pressed={goal === g}>
                {GOALS[g]}
              </button>
            ))}
          </div>
          {goal !== 'maintien' && (
            <label className="field">
              <span>Poids visé (kg)</span>
              <input inputMode="decimal" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
            </label>
          )}
          <div className="field">
            <span>Ton activité</span>
            <div className="col" style={{ gap: 8 }}>
              {ACTIVITY.map((a) => (
                <button key={a.v} className="card press list-row" style={{ boxShadow: activity === a.v ? 'inset 0 0 0 2px var(--brand)' : undefined }} onClick={() => setActivity(a.v)} aria-pressed={activity === a.v}>
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{a.label}</div>
                    <div className="small muted">{a.hint}</div>
                  </div>
                  {activity === a.v && <Icon name="check" style={{ color: 'var(--brand-ink)' }} />}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="col" style={{ gap: 18 }}>
          <h1 className="title">Ton programme</h1>
          <div className="col" style={{ gap: 8 }}>
            {PROGRAMS.map((p) => (
              <button key={p.id} className="card press list-row" style={{ boxShadow: program === p.id ? 'inset 0 0 0 2px var(--brand)' : undefined }} onClick={() => setProgram(p.id)} aria-pressed={program === p.id}>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{p.label}</div>
                  <div className="small muted">{p.hint}</div>
                </div>
                {program === p.id && <Icon name="check" style={{ color: 'var(--brand-ink)' }} />}
              </button>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Tu pourras changer les jours, les exercices et les séries à tout moment.
          </p>
        </section>
      )}

      {step === 4 && targets && (
        <section className="col" style={{ gap: 14 }}>
          <h1 className="title">Ton plan, {profile.name}</h1>
          <div className="card col" style={{ gap: 10 }}>
            <span className="small muted">Chaque jour</span>
            <span className="big-num">{fmtNum(targets.kcal)} kcal</span>
            <span className="small">
              Protéines {targets.p} g · Glucides {targets.g} g · Lipides {targets.l} g
            </span>
          </div>
          <div className="card tight">
            {defaultMeals().map((m, i) => {
              const p = Math.round(targets.p * m.share.p);
              const g = Math.round(targets.g * m.share.g);
              const l = Math.round(targets.l * m.share.l);
              return (
                <div key={i} className="list-row">
                  <span className="small" style={{ width: 46, fontWeight: 600, color: 'var(--ink2)' }}>
                    {hhmm(m.time)}
                  </span>
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {m.name}
                  </span>
                  <span className="small muted">{kcalOf({ p, g, l })} kcal</span>
                </div>
              );
            })}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Les heures des repas se changent dans les réglages. Chaque semaine, Élan ajuste tes calories selon l’évolution de ton poids.
          </p>
        </section>
      )}

      <div style={{ marginTop: 'auto' }}>
        {step < steps.length - 1 ? (
          <button className="btn brand press" disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continuer
          </button>
        ) : (
          <button className="btn brand press" disabled={saving || !targets} onClick={finish}>
            {saving ? 'Préparation…' : 'C’est parti'}
          </button>
        )}
      </div>
    </main>
  );
}
