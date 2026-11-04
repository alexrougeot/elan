// Nombre de séances par semaine et jours d'entraînement.
import { DEFAULT_DAYS } from '../lib/program';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export function programKind(count: number) {
  if (count <= 3) return { title: 'Full body', text: 'Tout le corps à chaque séance. Idéal à 2 ou 3 séances.' };
  if (count === 4) return { title: 'Haut / bas', text: 'Haut du corps et jambes en alternance : chaque muscle 2 fois par semaine.' };
  return { title: 'Haut / bas + full body', text: 'Les 4 séances haut / bas, plus une séance tout le corps.' };
}

export default function ProgramChooser({ count, days, onChange }: { count: number; days: number[]; onChange: (count: number, days: number[]) => void }) {
  const kind = programKind(count);
  const missing = count - days.length;

  function toggle(wd: number) {
    if (days.includes(wd)) onChange(count, days.filter((d) => d !== wd));
    else if (days.length < count) onChange(count, [...days, wd].sort((a, b) => a - b));
    else onChange(count, [...days.slice(1), wd].sort((a, b) => a - b));
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="col" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Séances de muscu par semaine
        </span>
        <div className="segmented" role="group" aria-label="Séances par semaine">
          {[2, 3, 4, 5].map((n) => (
            <button key={n} aria-pressed={count === n} onClick={() => onChange(n, DEFAULT_DAYS[n])}>
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Tes jours
        </span>
        <div className="row" style={{ gap: 6, justifyContent: 'space-between' }} role="group" aria-label="Jours d’entraînement">
          {LETTERS.map((l, i) => {
            const wd = i + 1;
            const on = days.includes(wd);
            return (
              <button
                key={wd}
                className="press"
                aria-pressed={on}
                aria-label={NAMES[i]}
                onClick={() => toggle(wd)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  border: 'none',
                  fontWeight: 700,
                  background: on ? 'var(--brand)' : 'var(--line2)',
                  color: on ? '#fff' : 'var(--ink2)',
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
        {missing > 0 && (
          <span className="small" style={{ color: 'var(--amber-ink)' }}>
            Choisis encore {missing} jour{missing > 1 ? 's' : ''}.
          </span>
        )}
      </div>
      <div className="card col" style={{ gap: 2, background: 'var(--brand-tint)', boxShadow: 'none' }}>
        <span style={{ fontWeight: 700, color: 'var(--brand-deep)' }}>{kind.title}</span>
        <span className="small" style={{ color: 'var(--brand-deep)' }}>
          {kind.text}
        </span>
      </div>
    </div>
  );
}
