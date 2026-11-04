import { useEffect, useState } from 'react';
import { getData } from '../lib/store';
import { addDays, dayKey } from '../lib/dates';
import { currentWeight, type Profile } from '../lib/nutrition';
import { ACTIVITY, activityKcal, fuelBonus, pace, saveActivity, type Activity, type ActivityType } from '../lib/activity';
import { haptic } from '../lib/device';
import { Icon, Sheet, Stepper, showToast } from './ui';

const TYPES: ActivityType[] = ['course', 'velo', 'natation', 'marche', 'autre'];
const DEFAULTS: Record<ActivityType, { km: number; step: number; minutes: number }> = {
  course: { km: 6, step: 0.5, minutes: 40 },
  velo: { km: 20, step: 1, minutes: 60 },
  natation: { km: 1, step: 0.25, minutes: 30 },
  marche: { km: 5, step: 0.5, minutes: 60 },
  autre: { km: 0, step: 1, minutes: 45 },
  circuit: { km: 0, step: 1, minutes: 45 },
};

/** Ce qu'on ajoute dans l'assiette pour compenser, avec des aliments simples */
export function bonusFood(kcal: number) {
  if (kcal <= 150) return 'une banane et une tranche de pain complet';
  if (kcal <= 250) return 'une banane et deux tranches de pain complet';
  if (kcal <= 350) return '80 g de pâtes (crues) en plus à un repas';
  return '80 g de pâtes (crues) en plus et une banane';
}

export default function ActivitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profile = getData<Profile>('profile');
  const [type, setType] = useState<ActivityType>('course');
  const [minutes, setMinutes] = useState(40);
  const [km, setKm] = useState(6);
  const [rpe, setRpe] = useState(2);
  const [duo, setDuo] = useState(false);
  const [yesterday, setYesterday] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYesterday(false);
  }, [open]);

  function pick(t: ActivityType) {
    setType(t);
    setKm(DEFAULTS[t].km);
    setMinutes(DEFAULTS[t].minutes);
  }

  const def = ACTIVITY[type];
  const date = yesterday ? addDays(dayKey(), -1) : dayKey();
  const draft: Activity = { date, type, minutes, km: def.distance ? km : undefined, rpe, duo, at: '' };
  const kcal = activityKcal(draft, currentWeight(profile) ?? profile?.weight);
  const bonus = fuelBonus(kcal, profile?.goal);

  async function save() {
    haptic();
    const { at: _at, ...rest } = draft;
    await saveActivity(rest);
    showToast(`${def.label} enregistrée${bonus && !yesterday ? ` : +${bonus} kcal à manger aujourd’hui` : ''}`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Noter une activité">
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Type d’activité">
        {TYPES.map((t) => (
          <button key={t} className={'chip press' + (t === type ? ' on' : '')} aria-pressed={t === type} onClick={() => pick(t)}>
            {ACTIVITY[t].label}
          </button>
        ))}
      </div>

      <div className="segmented" role="group" aria-label="Jour">
        <button aria-pressed={!yesterday} onClick={() => setYesterday(false)}>
          Aujourd’hui
        </button>
        <button aria-pressed={yesterday} onClick={() => setYesterday(true)}>
          Hier
        </button>
      </div>

      <div className="col" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Durée
        </span>
        <Stepper value={minutes} onChange={(v) => setMinutes(Math.max(5, v))} step={5} unit="min" />
      </div>

      {def.distance && (
        <div className="col" style={{ gap: 6 }}>
          <span className="small muted" style={{ fontWeight: 600 }}>
            Distance
          </span>
          <Stepper value={km} onChange={setKm} step={DEFAULTS[type].step} unit="km" format={(v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} />
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

      <div className="segmented" role="group" aria-label="Seul ou à deux">
        <button aria-pressed={!duo} onClick={() => setDuo(false)}>
          Seul
        </button>
        <button aria-pressed={duo} onClick={() => setDuo(true)}>
          À deux
        </button>
      </div>

      <div className="card col" style={{ gap: 6, background: 'var(--orange-tint)', boxShadow: 'none', color: 'var(--orange-ink)' }}>
        <span className="row small" style={{ gap: 8, fontWeight: 700 }}>
          <Icon name="flame" size={18} />
          Environ {kcal} kcal dépensées{type === 'course' && km ? ` · ${pace(minutes, km)}` : ''}
        </span>
        {bonus > 0 && (
          <span className="small">
            Pour ne pas freiner ta prise de masse, ajoute environ {bonus} kcal {yesterday ? 'aujourd’hui' : 'dans la journée'} : {bonusFood(bonus)}.
          </span>
        )}
      </div>

      <button className="btn brand press" onClick={save}>
        <Icon name="check" />
        Enregistrer
      </button>
    </Sheet>
  );
}
