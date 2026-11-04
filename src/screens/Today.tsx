import { useEffect, useState } from 'react';
import type { Tab } from '../App';
import { getData, useStoreVersion } from '../lib/store';
import { dayKey, fmtKg, fmtNum, hhmm, longDate, minutesOf, nowMinutes } from '../lib/dates';
import {
  currentWeight,
  foodsOn,
  getTargets,
  isSunday,
  mealTarget,
  runWeeklyAdjustment,
  sum,
  entryMacros,
  totalsOn,
  undoAdjustment,
  type Profile,
} from '../lib/nutrition';
import { estimateMinutes } from '../lib/program';
import { activeSession, extraFor, getProgram, planFor, sessionToday } from '../lib/workout';
import { isDeloadWeek } from '../lib/coach';
import { useSyncStatus } from '../lib/sync';
import { Icon, LogoMark, MacroBar, Ring, showToast } from '../components/ui';
import WeighInSheet from '../components/WeighIn';
import WeeklyReview from '../components/WeeklyReview';

export default function Today({ go, openSettings }: { go: (t: Tab) => void; openSettings: () => void }) {
  useStoreVersion();
  const today = dayKey();
  const profile = getData<Profile>('profile')!;
  const targets = getTargets();
  const program = getProgram();
  const plan = planFor(program);
  const extra = extraFor(program);
  const active = activeSession();
  const done = plan ? sessionToday(plan.id) : undefined;
  const totals = totalsOn(today);
  const weightToday = getData('weight:' + today);
  const weight = currentWeight(profile);
  const sync = useSyncStatus();
  const [weighIn, setWeighIn] = useState(false);
  const [review, setReview] = useState(false);

  useEffect(() => {
    runWeeklyAdjustment(profile).then((adj) => {
      if (!adj) return;
      const t = getTargets();
      const idx = (t?.history.length ?? 1) - 1;
      showToast(`Calories ajustées : ${adj.delta > 0 ? '+' : ''}${adj.delta} kcal`, { label: 'Annuler', run: () => void undoAdjustment(idx) }, 7000);
    });
  }, []);

  // Prochain repas
  const now = nowMinutes();
  const foods = foodsOn(today);
  const meals = targets?.meals ?? [];
  let next = meals.findIndex((m, i) => {
    const eaten = foods.some((f) => f.data.meal === i);
    return !eaten && minutesOf(m.time) >= now - 45;
  });
  if (next < 0) next = meals.findIndex((_, i) => !foods.some((f) => f.data.meal === i));
  const nextTarget = targets && next >= 0 ? mealTarget(targets, next) : null;
  const nextEaten = next >= 0 ? sum(foods.filter((f) => f.data.meal === next).map((f) => entryMacros(f.data))) : null;

  const start = profile.weight;
  const goalW = profile.goalWeight;
  const progress = weight !== undefined && goalW !== start ? Math.max(0, Math.min(1, (weight - start) / (goalW - start))) : 0;
  const deload = program ? isDeloadWeek(program) : false;

  return (
    <main className="screen">
      <header className="screen-head">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{longDate(today)}</span>
          <h1 className="title">Bonjour {profile.name}</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn press" aria-label="Réglages" onClick={openSettings}>
            <Icon name="gear" />
          </button>
          <LogoMark size={44} />
        </div>
      </header>

      {sync === 'offline' && (
        <div className="row small" style={{ gap: 8, color: 'var(--ink2)' }}>
          <Icon name="offline" size={18} />
          Hors ligne : tout est enregistré sur ton téléphone et sera synchronisé plus tard.
        </div>
      )}

      {deload && (
        <div className="card row" style={{ background: 'var(--amber-tint)', boxShadow: 'none' }}>
          <Icon name="info" style={{ color: 'var(--amber-ink)' }} />
          <span className="small" style={{ color: 'var(--amber-ink)' }}>
            Semaine légère : une série de moins et des charges un peu plus basses pour bien récupérer.
          </span>
        </div>
      )}

      {/* Séance */}
      <button className="card press col" style={{ border: 'none', textAlign: 'left', gap: 12 }} onClick={() => go('workout')}>
        <div className="row">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <Icon name="dumbbell" style={{ color: 'var(--brand-ink)' }} />
          </div>
          <div className="grow col" style={{ gap: 2 }}>
            <span className="tiny muted" style={{ fontWeight: 500 }}>
              Séance du jour
            </span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>
              {active ? `${active.data.title} · en cours` : plan ? `${plan.title}${plan.subtitle ? ' · ' + plan.subtitle : ''}` : 'Repos'}
            </span>
          </div>
          {done?.data.endedAt ? (
            <span className="badge">Terminée</span>
          ) : active ? (
            <span className="badge amber">En cours</span>
          ) : plan ? (
            <span className="badge gray">{estimateMinutes(plan)} min</span>
          ) : null}
        </div>
        <span className="small muted">
          {active
            ? 'Touche pour reprendre où tu en étais.'
            : done?.data.endedAt
              ? 'Bien joué. Pense à bien manger après la séance.'
              : plan
                ? `${plan.exercises.length} exercices · touche pour commencer`
                : extra
                  ? extra.title
                  : 'Pas de séance prévue aujourd’hui : récupère bien.'}
        </span>
        {extra && plan && <span className="small muted">Et aussi : {extra.title}</span>}
      </button>

      {/* Calories */}
      {targets && (
        <button className="card press row" style={{ border: 'none', textAlign: 'left', gap: 18, alignItems: 'center' }} onClick={() => go('nutrition')}>
          <Ring value={totals.k / targets.kcal} size={108} label={`${fmtNum(totals.k)} sur ${fmtNum(targets.kcal)} kilocalories`}>
            <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtNum(totals.k)}</span>
            <span className="tiny muted">sur {fmtNum(targets.kcal)} kcal</span>
          </Ring>
          <div className="grow col" style={{ gap: 10 }}>
            <MacroBar label="Protéines" value={totals.p} target={targets.p} color="#059669" />
            <MacroBar label="Glucides" value={totals.g} target={targets.g} color="var(--lime)" />
            <MacroBar label="Lipides" value={totals.l} target={targets.l} color="var(--amber)" />
          </div>
        </button>
      )}

      {/* Prochain repas */}
      {targets && next >= 0 && nextTarget && (
        <button
          className="card press col"
          style={{ border: 'none', textAlign: 'left', gap: 6, background: 'var(--feature)', color: 'var(--feature-ink)', boxShadow: 'none' }}
          onClick={() => go('nutrition')}
        >
          <div className="row between">
            <span className="tiny" style={{ fontWeight: 700, color: 'var(--feature-accent)' }}>
              Prochain repas · {hhmm(meals[next].time)}
            </span>
            <Icon name="bell" size={20} style={{ color: 'var(--feature-accent)' }} />
          </div>
          <span style={{ fontSize: 19, fontWeight: 700 }}>{meals[next].name}</span>
          <span className="small" style={{ color: 'var(--feature-ink2)' }}>
            {nextTarget.k} kcal · P {nextTarget.p} g · G {nextTarget.g} g · L {nextTarget.l} g
            {nextEaten && nextEaten.k > 0 ? ` · déjà ${Math.round(nextEaten.k)} kcal` : ''}
          </span>
          {meals[next].hint && (
            <span className="small" style={{ color: '#94A3B8' }}>
              {meals[next].hint}
            </span>
          )}
        </button>
      )}

      {/* Poids */}
      <section className="card col" style={{ gap: 10 }}>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="col" style={{ gap: 2 }}>
            <span className="tiny muted" style={{ fontWeight: 500 }}>
              Poids moyen sur 7 jours
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{weight !== undefined ? fmtKg(weight) + ' kg' : '—'}</span>
          </div>
          {profile.goal !== 'maintien' && (
            <span className="small" style={{ fontWeight: 600, color: 'var(--brand-ink)' }}>
              Objectif {fmtKg(goalW, goalW % 1 ? 1 : 0)} kg
            </span>
          )}
        </div>
        {profile.goal !== 'maintien' && (
          <div className="bar" style={{ height: 8 }}>
            <div style={{ width: Math.max(3, progress * 100) + '%', background: 'var(--brand)' }} />
          </div>
        )}
        <div className="row between">
          <span className="tiny muted">
            {weight !== undefined && profile.goal !== 'maintien'
              ? `Encore ${fmtKg(Math.abs(goalW - weight))} kg ${goalW > weight ? 'à prendre' : 'à perdre'}`
              : 'Pèse-toi chaque matin pour suivre la tendance.'}
          </span>
          <button className={'btn small press ' + (weightToday ? 'ghost' : 'soft')} onClick={() => setWeighIn(true)}>
            <Icon name="scale" size={18} />
            {weightToday ? 'Modifier' : 'Me peser'}
          </button>
        </div>
      </section>

      {isSunday() && (
        <button className="card press row" style={{ border: 'none', textAlign: 'left' }} onClick={() => setReview(true)}>
          <Icon name="flag" style={{ color: 'var(--brand-ink)' }} />
          <div className="grow col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700 }}>Bilan de la semaine</span>
            <span className="small muted">Tes séances, tes calories, ton poids et l’ajustement.</span>
          </div>
          <Icon name="right" style={{ color: 'var(--ink3)' }} />
        </button>
      )}

      <WeighInSheet open={weighIn} onClose={() => setWeighIn(false)} />
      <WeeklyReview open={review} onClose={() => setReview(false)} />
    </main>
  );
}
