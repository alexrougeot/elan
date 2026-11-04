import { useEffect, useState } from 'react';
import { dayKey, fmtKg } from '../lib/dates';
import { getData, putDoc } from '../lib/store';
import { currentWeight, type Profile, type WeighIn as W } from '../lib/nutrition';
import { haptic } from '../lib/device';
import { Sheet, Stepper, showToast } from './ui';

export default function WeighInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const today = dayKey();
  const [kg, setKg] = useState(70);

  useEffect(() => {
    if (!open) return;
    const existing = getData<W>('weight:' + today)?.kg;
    const profile = getData<Profile>('profile');
    setKg(Math.round((existing ?? currentWeight(profile) ?? 70) * 10) / 10);
  }, [open, today]);

  async function save() {
    haptic();
    await putDoc('weight:' + today, 'weight', { date: today, kg });
    showToast(`Pesée enregistrée : ${fmtKg(kg)} kg`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Pesée du jour">
      <p className="small muted" style={{ margin: 0 }}>
        Le matin, à jeun, après être passé aux toilettes. Élan lisse les variations avec la moyenne sur 7 jours.
      </p>
      <Stepper value={kg} onChange={setKg} step={0.1} unit="kg" format={(v) => fmtKg(v)} />
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        {[-1, -0.5, 0.5, 1].map((d) => (
          <button key={d} className="chip press" onClick={() => setKg(Math.round((kg + d) * 10) / 10)}>
            {d > 0 ? '+' : '−'}
            {fmtKg(Math.abs(d))}
          </button>
        ))}
      </div>
      <button className="btn brand press" onClick={save}>
        Enregistrer
      </button>
    </Sheet>
  );
}
