// « Pas aujourd'hui » : sauter ou décaler la séance du jour, et noter ce qu'on fait à la place.
import { useEffect, useState } from 'react';
import { addDays, dayKey, longDate, parseDay, weekStart } from '../lib/dates';
import { getProgram, planFor, skipDay } from '../lib/workout';
import { haptic } from '../lib/device';
import { Icon, Sheet, showToast } from './ui';
import ActivitySheet from './ActivitySheet';

export default function SkipSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const program = getProgram();
  const today = dayKey();
  const plan = planFor(program);
  const [to, setTo] = useState<string | null>(null);
  const [log, setLog] = useState(false);

  useEffect(() => {
    if (open) setTo(null);
  }, [open]);

  // jours libres d'ici dimanche
  const sunday = addDays(weekStart(today), 6);
  const free: string[] = [];
  for (let d = addDays(today, 1); d <= sunday; d = addDays(d, 1)) if (!planFor(program, parseDay(d))) free.push(d);

  async function confirm(thenLog: boolean) {
    if (!plan) return;
    haptic();
    await skipDay(plan.id, today, to ?? undefined);
    showToast(to ? `${plan.title} décalée à ${longDate(to).split(' ')[0].toLowerCase()}` : `${plan.title} sautée cette semaine`);
    onClose();
    if (thenLog) setTimeout(() => setLog(true), 350);
  }

  return (
    <>
      <Sheet open={open && !!plan} onClose={onClose} title="Pas de séance aujourd’hui ?">
        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Pas de souci, ça arrive. Rien ne baisse : à ta prochaine séance, tes charges repartent de la dernière fois que tu as fait chaque exercice.
        </p>

        {free.length > 0 && (
          <div className="col" style={{ gap: 8 }}>
            <span className="small" style={{ fontWeight: 700 }}>
              Rattraper {plan?.title} cette semaine ?
            </span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className={'chip press' + (to === null ? ' on' : '')} aria-pressed={to === null} onClick={() => setTo(null)}>
                Non, je la saute
              </button>
              {free.map((d) => (
                <button key={d} className={'chip press' + (to === d ? ' on' : '')} aria-pressed={to === d} onClick={() => setTo(d)}>
                  {longDate(d).split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn brand press" onClick={() => confirm(true)}>
          <Icon name="users" />
          Cours collectif à la place
        </button>
        <button className="btn soft press" onClick={() => confirm(false)}>
          {to ? 'Décaler la séance' : 'Juste sauter la séance'}
        </button>
        <p className="tiny muted" style={{ margin: 0 }}>
          Ton programme ne change pas : seule cette semaine est modifiée. Tu peux annuler depuis l’accueil.
        </p>
      </Sheet>
      <ActivitySheet open={log} onClose={() => setLog(false)} initial="cours" duoDefault />
    </>
  );
}
