import { useEffect, useState } from 'react';
import type { Tab } from '../App';
import { getData, useStoreVersion } from '../lib/store';
import { addDays, dayKey, fmtKg, fmtNum, hhmm, longDate, minutesOf, nowMinutes, parseDay, weekStart, weekday } from '../lib/dates';
import { currentWeight, entryMacros, foodsOn, getTargets, isSunday, mealTarget, runWeeklyAdjustment, sum, totalsOn, undoAdjustment, type Profile } from '../lib/nutrition';
import { estimateMinutes, exName } from '../lib/program';
import { activeSession, extraFor, getMoves, getProgram, planFor, sessionToday, undoSkip, usualPlan } from '../lib/workout';
import SkipSheet from '../components/SkipSheet';
import { isDeloadWeek, sessions } from '../lib/coach';
import { useSyncStatus } from '../lib/sync';
import { getLink, healthForSession, healthLine, healthOn, runShortcut } from '../lib/health';
import { addWater, GLASS, WATER_REMINDERS, waterGoal, waterOn } from '../lib/water';
import { ACTIVITY, activities, activitiesOn, activityKcal, activityLine, askCircuit, fuelBonus } from '../lib/activity';
import ActivitySheet, { bonusFood } from '../components/ActivitySheet';
import { fetchRun, openRun } from './Runs';
import { haptic } from '../lib/device';
import { putDoc } from '../lib/store';
import { HeroLeaves, Icon, LogoMark, Ring, mealVisual, showToast } from '../components/ui';
import WeighInSheet from '../components/WeighIn';
import WeeklyReview from '../components/WeeklyReview';

function greeting() {
  const h = new Date().getHours();
  if (h >= 18) return 'Bonsoir';
  if (h >= 13) return 'Bon après-midi';
  return 'Bonjour';
}

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
  const [actOpen, setActOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const moves = getMoves();
  const usual = usualPlan(program);
  const skipped = !plan && !!usual && moves[today] === null && !sessionToday(usual.id);
  const movedTo = skipped ? Object.keys(moves).find((k) => k > today && moves[k] === usual!.id) : undefined;
  const todayActs = activitiesOn(today);
  const weekend = [6, 7].includes(weekday(parseDay(today)));

  // objectif d'hydratation enregistré pour les rappels
  useEffect(() => {
    const t = getTargets();
    if (t && !t.water) void putDoc('targets', 'targets', { ...t, water: { goalMl: waterGoal(profile), reminders: WATER_REMINDERS } });
  }, []);

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
  let next = meals.findIndex((m, i) => !foods.some((f) => f.data.meal === i) && minutesOf(m.time) >= now - 45);
  if (next < 0) next = meals.findIndex((_, i) => !foods.some((f) => f.data.meal === i));
  const nextTarget = targets && next >= 0 ? mealTarget(targets, next) : null;
  const nextEaten = next >= 0 ? sum(foods.filter((f) => f.data.meal === next).map((f) => entryMacros(f.data))) : null;

  // Semaine
  const monday = weekStart(today);
  const doneDates = new Set(sessions().filter((s) => s.data.endedAt).map((s) => s.data.date));
  const actDates = new Set(activities().map((a) => a.data.date));

  const extraDays = new Set(program?.extras.map((d) => d.weekday) ?? []);
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(monday, i);
    const wd = weekday(parseDay(key));
    const started = !program || key >= program.startDate;
    const planned = !!planFor(program, parseDay(key));
    const skip = !planned && !!usualPlan(program, parseDay(key)) && moves[key] === null;
    const state = doneDates.has(key)
      ? 'done'
      : actDates.has(key)
        ? 'activity'
        : planned && started
          ? key < today
            ? 'missed'
            : 'planned'
          : skip
            ? 'skipped'
            : extraDays.has(wd) && started
              ? 'extra'
              : '';
    return { key, wd, state, day: parseDay(key).getDate() };
  });
  const doneThisWeek = week.filter((d) => d.state === 'done').length;

  const start = profile.weight;
  const goalW = profile.goalWeight;
  const progress = weight !== undefined && goalW !== start ? Math.max(0, Math.min(1, (weight - start) / (goalW - start))) : 0;
  const deload = program ? isDeloadWeek(program) : false;
  const left = targets ? targets.kcal - totals.k : 0;

  return (
    <main className="screen">
      <header className="screen-head">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{longDate(today)}</span>
          <h1 className="title">
            {greeting()} {profile.name}
          </h1>
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

      {/* Calories : la carte héros */}
      {targets && (
        <button className="hero press col" style={{ border: 'none', textAlign: 'left', gap: 14 }} onClick={() => go('nutrition')}>
          <HeroLeaves />
          <div className="row between">
            <span className="hero-chip">
              <Icon name="flame" size={15} />
              Calories du jour
            </span>
            <span className="small on-hero-2">{Math.round((totals.k / targets.kcal) * 100)} %</span>
          </div>
          <div className="row" style={{ gap: 18 }}>
            <Ring value={totals.k / targets.kcal} size={116} stroke={13} color="#BEF264" track="rgba(255,255,255,0.18)" label={`${fmtNum(Math.abs(left))} kilocalories ${left >= 0 ? 'restantes' : 'en trop'}`}>
              <span style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>{fmtNum(Math.abs(left))}</span>
              <span className="tiny on-hero-2">{left >= 0 ? 'kcal restantes' : 'kcal en trop'}</span>
            </Ring>
            <div className="grow col" style={{ gap: 11 }}>
              {[
                ['Protéines', totals.p, targets.p, '#A7F3D0'],
                ['Glucides', totals.g, targets.g, '#BEF264'],
                ['Lipides', totals.l, targets.l, '#FCD34D'],
              ].map(([l, v, t, c]) => (
                <div key={l as string} className="col" style={{ gap: 5 }}>
                  <div className="row between small">
                    <span style={{ fontWeight: 650 }}>{l as string}</span>
                    <span className="on-hero-2">
                      {Math.round(v as number)} / {t as number} g
                    </span>
                  </div>
                  <div className="bar" style={{ background: 'rgba(255,255,255,0.18)' }}>
                    <div style={{ width: Math.min(100, ((v as number) / (t as number)) * 100) + '%', background: c as string }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </button>
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
      <section className="card col" style={{ gap: 12 }}>
        <div className="row">
          <span className="tile tint-brand">
            <Icon name="dumbbell" />
          </span>
          <div className="grow col" style={{ gap: 2 }}>
            <span className="tiny muted" style={{ fontWeight: 500 }}>
              Séance du jour
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {active ? active.data.title : plan ? `${plan.title}${plan.subtitle ? ' · ' + plan.subtitle : ''}` : skipped ? `${usual!.title} · ${movedTo ? 'décalée' : 'sautée'}` : weekend ? 'Week-end libre' : 'Repos'}
            </span>
          </div>
          {done?.data.endedAt ? (
            <span className="badge">
              <Icon name="check" size={13} stroke={2.8} />
              Terminée
            </span>
          ) : active ? (
            <span className="badge amber">En cours</span>
          ) : plan ? (
            <span className="badge gray">{estimateMinutes(plan)} min</span>
          ) : null}
        </div>
        {plan && !done?.data.endedAt && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {plan.exercises.slice(0, 3).map((e, i) => (
              <span key={i} className="muscle" style={{ background: 'var(--line2)', color: 'var(--ink2)', fontWeight: 600 }}>
                {exName(e.key)}
              </span>
            ))}
            {plan.exercises.length > 3 && (
              <span className="muscle" style={{ background: 'var(--line2)', color: 'var(--ink2)', fontWeight: 600 }}>
                +{plan.exercises.length - 3}
              </span>
            )}
          </div>
        )}
        {skipped && (
          <div className="row between" style={{ gap: 8 }}>
            <span className="small muted">{movedTo ? `Tu la fais ${longDate(movedTo).split(' ').slice(0, 2).join(' ').toLowerCase()} à la place.` : 'Pas de séance aujourd’hui, profite.'}</span>
            <button className="chip press" onClick={() => void undoSkip(today)}>
              Annuler
            </button>
          </div>
        )}
        {skipped && todayActs.length === 0 && (
          <button className="btn soft press" onClick={() => setActOpen(true)}>
            <Icon name="users" size={19} />
            Noter mon cours collectif
          </button>
        )}
        {!plan && !active && !skipped && !(weekend && todayActs.length === 0) && (
          <span className="small muted">{todayActs.length ? 'Activité enregistrée, bien joué. Le reste de la journée : on récupère.' : extra ? extra.title : 'Pas de séance prévue aujourd’hui : récupère bien.'}</span>
        )}
        {!plan && !active && weekend && todayActs.length === 0 && (
          <>
            <span className="small muted">Week-end : une course, une séance type Hyrox à la salle, ou du repos. Tout compte.</span>
            <div className="fields-2">
              <button className="btn soft press" onClick={fetchRun}>
                <Icon name="run" size={19} />
                Course
              </button>
              <button
                className="btn soft press"
                onClick={() => {
                  askCircuit();
                  go('workout');
                }}
              >
                <Icon name="bolt" size={19} />
                Hyrox
              </button>
            </div>
          </>
        )}
        {done?.data.endedAt && (() => {
          const h = healthForSession(done.id);
          return h ? (
            <div className="row small" style={{ gap: 8, background: 'var(--sky-tint)', color: 'var(--sky-ink)', padding: '10px 12px', borderRadius: 14, fontWeight: 600 }}>
              <Icon name="timer" size={18} />
              {h.source} : {healthLine(h)}
            </div>
          ) : (
            <div className="row between" style={{ gap: 8 }}>
              <span className="small muted">Bien joué. Pense à bien manger après la séance.</span>
              {getLink() && (
                <button className="chip press" onClick={runShortcut}>
                  <Icon name="timer" size={16} />
                  Montre
                </button>
              )}
            </div>
          );
        })()}
        {(plan || active) && !done?.data.endedAt && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn brand press grow" style={{ minHeight: 48 }} onClick={() => go('workout')}>
              <Icon name={active ? 'timer' : 'dumbbell'} size={20} />
              {active ? 'Reprendre la séance' : 'Commencer'}
            </button>
            {!active && (
              <button className="btn ghost press" style={{ minHeight: 48, width: 'auto', paddingInline: 14 }} onClick={() => setSkipOpen(true)}>
                Pas aujourd’hui
              </button>
            )}
          </div>
        )}
        {extra && plan && <span className="small muted">Et aussi : {extra.title.toLowerCase()}</span>}
      </section>

      {todayActs.map((a) => {
        const watch = healthOn(today)
          .filter((h) => !h.sessionId && h.kcal)
          .reduce((x, h) => x + (h.kcal ?? 0), 0);
        const kcal = watch || activityKcal(a.data, weight);
        const bonus = fuelBonus(kcal, profile.goal);
        return (
          <section
            key={a.id}
            className={'card col' + (a.data.type === 'course' ? ' press' : '')}
            style={{ gap: 10 }}
            role={a.data.type === 'course' ? 'button' : undefined}
            tabIndex={a.data.type === 'course' ? 0 : undefined}
            onClick={a.data.type === 'course' ? () => openRun(a.id) : undefined}
          >
            <div className="row">
              <span className={'tile ' + (a.data.type === 'circuit' ? 'tint-orange' : 'tint-sky')}>
                <Icon name={ACTIVITY[a.data.type].icon} />
              </span>
              <div className="grow col" style={{ gap: 2 }}>
                <span className="tiny muted" style={{ fontWeight: 500 }}>
                  {ACTIVITY[a.data.type].label} du jour
                </span>
                <span style={{ fontWeight: 700 }}>{activityLine(a.data)}</span>
              </div>
              <span className="badge gray">{kcal} kcal</span>
            </div>
            {bonus > 0 && (
              <span className="small" style={{ color: 'var(--orange-ink)', background: 'var(--orange-tint)', padding: '10px 12px', borderRadius: 14 }}>
                Ajoute environ {bonus} kcal aujourd’hui pour ne pas freiner ta prise de masse : {bonusFood(bonus)}.
              </span>
            )}
          </section>
        );
      })}

      {healthOn(today)
        .filter((h) => !h.sessionId)
        .map((h) => (
          <section key={h.at} className="card row">
            <span className="tile tint-sky">
              <Icon name="flame" />
            </span>
            <div className="grow col" style={{ gap: 2 }}>
              <span className="tiny muted" style={{ fontWeight: 500 }}>
                Activité du jour · {h.source}
              </span>
              <span style={{ fontWeight: 700 }}>{healthLine(h)}</span>
            </div>
          </section>
        ))}

      {/* Semaine */}
      {program && program.days.length > 0 && (
        <section className="card col" style={{ gap: 12 }}>
          <div className="row between">
            <h2 className="h2">Ta semaine</h2>
            <span className="small muted">
              {doneThisWeek} / {program.days.length} séances
            </span>
          </div>
          <div className="week">
            {week.map((d) => (
              <div key={d.key} className={'week-day' + (d.key === today ? ' today' : '')}>
                <span>{'LMMJVSD'[d.wd - 1]}</span>
                <div className={'week-dot ' + d.state} aria-label={`${d.day}, ${d.state === 'done' ? 'séance faite' : d.state === 'planned' ? 'séance prévue' : d.state === 'missed' ? 'séance manquée' : d.state === 'extra' ? 'cours collectif' : d.state === 'activity' ? 'activité libre' : d.state === 'skipped' ? 'séance sautée' : 'repos'}`}>
                  {d.state === 'done' ? <Icon name="check" size={16} stroke={2.8} /> : d.state === 'activity' ? <Icon name="run" size={16} /> : d.state === 'extra' ? <Icon name="flame" size={15} /> : d.state === 'skipped' ? '–' : d.day}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prochain repas */}
      {targets && next >= 0 && nextTarget && (
        <button
          className="card press col"
          style={{ border: 'none', textAlign: 'left', gap: 10, background: 'var(--feature)', color: 'var(--feature-ink)', boxShadow: 'none', position: 'relative', overflow: 'hidden' }}
          onClick={() => go('nutrition')}
        >
          <HeroLeaves className="hero-leaves" color="#10B981" />
          <div className="row" style={{ position: 'relative' }}>
            <span className={'tile ' + mealVisual(meals[next].name, meals[next].time).tint}>
              <Icon name={mealVisual(meals[next].name, meals[next].time).icon} />
            </span>
            <div className="grow col" style={{ gap: 1 }}>
              <span className="tiny" style={{ fontWeight: 700, color: 'var(--feature-accent)' }}>
                Prochain repas · {hhmm(meals[next].time)}
              </span>
              <span style={{ fontSize: 19, fontWeight: 700 }}>{meals[next].name}</span>
            </div>
            <Icon name="bell" size={20} style={{ color: 'var(--feature-accent)' }} />
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', position: 'relative' }}>
            <span className="hero-chip" style={{ background: 'rgba(255,255,255,0.1)' }}>{nextTarget.k} kcal</span>
            <span className="hero-chip" style={{ background: 'rgba(255,255,255,0.1)' }}>P {nextTarget.p} g</span>
            <span className="hero-chip" style={{ background: 'rgba(255,255,255,0.1)' }}>G {nextTarget.g} g</span>
            <span className="hero-chip" style={{ background: 'rgba(255,255,255,0.1)' }}>L {nextTarget.l} g</span>
          </div>
          {meals[next].hint && (
            <span className="small" style={{ color: 'var(--feature-ink2)', position: 'relative' }}>
              {meals[next].hint}
              {nextEaten && nextEaten.k > 0 ? ` Déjà ${Math.round(nextEaten.k)} kcal notées.` : ''}
            </span>
          )}
        </button>
      )}

      {/* Poids */}
      <section className="card col" style={{ gap: 12 }}>
        <div className="row">
          <span className="tile tint-sky">
            <Icon name="scale" />
          </span>
          <div className="grow col" style={{ gap: 1 }}>
            <span className="tiny muted" style={{ fontWeight: 500 }}>
              Poids moyen sur 7 jours
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{weight !== undefined ? fmtKg(weight) + ' kg' : '—'}</span>
          </div>
          {profile.goal !== 'maintien' && (
            <div className="col" style={{ alignItems: 'flex-end', gap: 1 }}>
              <span className="tiny muted">Objectif</span>
              <span style={{ fontWeight: 700, color: 'var(--brand-ink)' }}>{fmtKg(goalW, goalW % 1 ? 1 : 0)} kg</span>
            </div>
          )}
        </div>
        {profile.goal !== 'maintien' && (
          <div className="progress-line" style={{ height: 8 }}>
            <div style={{ width: Math.max(3, progress * 100) + '%' }} />
          </div>
        )}
        <div className="row between">
          <span className="tiny muted">
            {weight !== undefined && profile.goal !== 'maintien'
              ? `Encore ${fmtKg(Math.abs(goalW - weight))} kg ${goalW > weight ? 'à prendre' : 'à perdre'}`
              : 'Pèse-toi chaque matin pour suivre la tendance.'}
          </span>
          <button className={'btn small press ' + (weightToday ? 'ghost' : 'soft')} onClick={() => setWeighIn(true)}>
            {weightToday ? 'Modifier' : 'Me peser'}
          </button>
        </div>
      </section>

      {/* Hydratation */}
      {(() => {
        const goal = waterGoal(profile, targets);
        const ml = waterOn(today);
        const glasses = Math.round(goal / GLASS);
        const drunk = Math.floor(ml / GLASS);
        return (
          <section className="card col" style={{ gap: 12 }}>
            <div className="row">
              <span className="tile tint-sky">
                <Icon name="drop" />
              </span>
              <div className="grow col" style={{ gap: 1 }}>
                <span className="tiny muted" style={{ fontWeight: 500 }}>
                  Hydratation
                </span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                  {(ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} L <span className="small muted">sur {(goal / 1000).toLocaleString('fr-FR')} L</span>
                </span>
              </div>
              <button className="icon-btn press" aria-label="Retirer un verre" onClick={() => void addWater(-GLASS)} disabled={ml === 0} style={{ opacity: ml === 0 ? 0.4 : 1 }}>
                <Icon name="minus" />
              </button>
              <button
                className="btn small press"
                style={{ background: 'var(--sky)', color: '#fff', width: 'auto' }}
                onClick={() => {
                  haptic();
                  void addWater(GLASS);
                }}
              >
                <Icon name="plus" size={18} />
                Verre
              </button>
            </div>
            <div className="row" style={{ gap: 4 }} aria-label={`${drunk} verres sur ${glasses}`}>
              {Array.from({ length: glasses }, (_, i) => (
                <span key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i < drunk ? 'var(--sky)' : 'var(--track)' }} />
              ))}
            </div>
          </section>
        );
      })()}

      {isSunday() && (
        <button className="card press row" style={{ border: 'none', textAlign: 'left' }} onClick={() => setReview(true)}>
          <span className="tile tint-violet">
            <Icon name="flag" />
          </span>
          <div className="grow col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700 }}>Bilan de la semaine</span>
            <span className="small muted">Tes séances, tes calories, ton poids et l’ajustement.</span>
          </div>
          <Icon name="right" style={{ color: 'var(--ink3)' }} />
        </button>
      )}

      <WeighInSheet open={weighIn} onClose={() => setWeighIn(false)} />
      <WeeklyReview open={review} onClose={() => setReview(false)} />
      <ActivitySheet open={actOpen} onClose={() => setActOpen(false)} initial={skipped ? 'cours' : undefined} duoDefault={skipped} />
      <SkipSheet open={skipOpen} onClose={() => setSkipOpen(false)} />
    </main>
  );
}
