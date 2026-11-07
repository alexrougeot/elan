// Records : tout ce qu'on a fait de mieux, avec la date. Les nouveaux sont mis en avant.
import { useState } from 'react';
import { useStoreVersion } from '../lib/store';
import { daysBetween, dayKey, longDate, shortDate } from '../lib/dates';
import { allRecords, isFresh, type Rec } from '../lib/records';
import { HeroLeaves, Icon } from '../components/ui';
import { openRun } from './Runs';
import { CircuitResultSheet } from './Circuit';

function when(date: string) {
  const d = daysBetween(date, dayKey());
  if (d === 0) return 'aujourd’hui';
  if (d === 1) return 'hier';
  if (d < 7) return longDate(date).split(' ')[0].toLowerCase();
  return shortDate(date);
}

export function RecordsView() {
  useStoreVersion();
  const groups = allRecords();
  const [circuit, setCircuit] = useState<string | null>(null);
  const fresh = groups.flatMap((g) => g.items).filter((r) => isFresh(r));

  if (!groups.length)
    return (
      <div className="card empty">
        Tes records apparaîtront dès tes premières pesées et séances : poids, charges, course, kettlebell, cœur… Tout est comparé à toi-même.
      </div>
    );

  function open(r: Rec) {
    if (!r.id) return;
    if (r.key.startsWith('r:')) openRun(r.id);
    else setCircuit(r.id);
  }

  return (
    <>
      <section className="hero col" style={{ gap: 8 }}>
        <HeroLeaves />
        <span className="hero-chip" style={{ alignSelf: 'flex-start' }}>
          <Icon name="trophy" size={15} />
          Toi contre toi
        </span>
        <span className="big-num">
          {fresh.length} record{fresh.length > 1 ? 's' : ''} battu{fresh.length > 1 ? 's' : ''}
        </span>
        <span className="small on-hero-2">
          {fresh.length ? `Ces 7 derniers jours : ${fresh.map((r) => r.label.toLowerCase()).slice(0, 3).join(', ')}${fresh.length > 3 ? '…' : '.'}` : 'Ces 7 derniers jours. Le prochain est peut-être pour demain matin.'}
        </span>
      </section>

      {groups.map((g) => (
        <section key={g.title} className="card col" style={{ gap: 4 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="tile sm tint-brand">
              <Icon name={g.icon} size={18} />
            </span>
            <h2 className="h2 grow">{g.title}</h2>
          </div>
          {g.items.map((r, i) => {
            const isNew = isFresh(r);
            const clickable = !!r.id;
            return (
              <div key={r.key}>
                <div
                  className={'list-row' + (clickable ? ' press' : '')}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => open(r) : undefined}
                  style={{ alignItems: 'flex-start', padding: '10px 0' }}
                >
                  <div className="grow col" style={{ gap: 2, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{r.label}</span>
                    {r.sub && <span className="tiny muted">{r.sub}</span>}
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', gap: 2, flex: 'none', maxWidth: '52%' }}>
                    <span style={{ fontWeight: 700, fontSize: 17, color: isNew ? 'var(--brand-ink)' : undefined, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{r.text}</span>
                    <span className="row tiny muted" style={{ gap: 6 }}>
                      {isNew && (
                        <span style={{ background: '#ECFCCB', color: '#3F6212', fontWeight: 700, borderRadius: 999, padding: '1px 7px' }}>Nouveau</span>
                      )}
                      {when(r.date)}
                    </span>
                  </div>
                </div>
                {i < g.items.length - 1 && <div className="divider" />}
              </div>
            );
          })}
        </section>
      ))}
      <p className="tiny muted" style={{ margin: '0 4px' }}>
        Les séances kettlebell et type Hyrox changent chaque semaine : les records comparent le même format (et la même forme de WOD), pas exactement les mêmes exercices.
      </p>
      <CircuitResultSheet id={circuit} onClose={() => setCircuit(null)} />
    </>
  );
}

export default function Records() {
  return (
    <main className="screen">
      <header className="screen-head">
        <h1 className="title">Records</h1>
      </header>
      <RecordsView />
    </main>
  );
}
