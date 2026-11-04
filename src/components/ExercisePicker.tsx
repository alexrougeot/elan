// Choisir un exercice dans le catalogue, ou en créer un nouveau.
import { useEffect, useState, type ReactNode } from 'react';
import { CATALOG, createCustomExercise, EQUIPMENTS, MUSCLES, type Equipment } from '../lib/program';
import { Icon, Sheet, showToast } from './ui';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Ajouter un exercice',
  first,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (key: string) => void;
  title?: string;
  /** exercices proposés en premier (ex. alternatives) */
  first?: { label: string; keys: string[] };
  footer?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>('Pectoraux');
  const [equipment, setEquipment] = useState<Equipment>('machine');
  const [timed, setTimed] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ('');
      setCreating(false);
    }
  }, [open]);

  const all = Object.values(CATALOG).filter((c) => !c.circuit);
  const found = all.filter((c) => !q || norm(c.name).includes(norm(q)) || norm(c.muscle).includes(norm(q)));
  const muscles = [...new Set([...MUSCLES, ...all.map((c) => c.muscle)])];
  const exact = all.some((c) => norm(c.name) === norm(q.trim()));

  function pick(key: string) {
    onPick(key);
    setQ('');
  }

  async function create() {
    const n = name.trim();
    if (!n) return;
    const key = await createCustomExercise({ name: n.charAt(0).toUpperCase() + n.slice(1), muscle, equipment, timed });
    showToast(`« ${n} » ajouté à tes exercices`);
    setCreating(false);
    pick(key);
  }

  const row = (key: string) => {
    const c = CATALOG[key];
    if (!c) return null;
    return (
      <button key={key} className="list-row press" style={{ margin: '0 -12px', width: 'calc(100% + 24px)' }} onClick={() => pick(key)}>
        <span className="grow col" style={{ gap: 1 }}>
          <span style={{ fontWeight: 600 }}>{c.name}</span>
          <span className="small muted">
            {c.equipment}
            {c.timed ? ' · en secondes' : ''}
            {c.custom ? ' · perso' : ''}
          </span>
        </span>
        <Icon name="plus" size={18} style={{ color: 'var(--brand-ink)' }} />
      </button>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={creating ? 'Créer un exercice' : title} full>
      {creating ? (
        <>
          <label className="field">
            <span>Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : curl pupitre machine" autoFocus />
          </label>
          <label className="field">
            <span>Muscle travaillé</span>
            <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              {MUSCLES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Matériel</span>
            <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
              {EQUIPMENTS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Type">
            <button aria-pressed={!timed} onClick={() => setTimed(false)}>
              Charge × reps
            </button>
            <button aria-pressed={timed} onClick={() => setTimed(true)}>
              En secondes
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Le coach le suit comme les autres : il te propose la charge à chaque séance et l’ajuste série par série.
          </p>
          <button className="btn brand press" onClick={create} disabled={!name.trim()}>
            <Icon name="check" />
            Créer et ajouter
          </button>
          <button className="btn ghost press" onClick={() => setCreating(false)}>
            Retour à la liste
          </button>
        </>
      ) : (
        <>
          <label>
            <span className="sr-only">Chercher</span>
            <input placeholder="Chercher : curl, pec deck, fentes…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button
            className="list-row press"
            style={{ margin: '0 -12px', width: 'calc(100% + 24px)' }}
            onClick={() => {
              setName(exact ? '' : q.trim());
              setCreating(true);
            }}
          >
            <span className="tile sm tint-violet">
              <Icon name="plus" size={18} />
            </span>
            <span className="grow col" style={{ gap: 1 }}>
              <span style={{ fontWeight: 650 }}>{q.trim() && !exact ? `Créer « ${q.trim()} »` : 'Créer mon propre exercice'}</span>
              <span className="small muted">Il n’est pas dans la liste ? Ajoute-le.</span>
            </span>
          </button>
          {footer}
          {first && first.keys.length > 0 && !q && (
            <div className="col" style={{ gap: 2 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>
                {first.label}
              </span>
              {first.keys.map(row)}
            </div>
          )}
          {muscles.map((m) => {
            const list = found.filter((c) => c.muscle === m);
            if (list.length === 0) return null;
            return (
              <div key={m} className="col" style={{ gap: 2 }}>
                <span className="small muted" style={{ fontWeight: 600 }}>
                  {m}
                </span>
                {list.map((c) => row(c.key))}
              </div>
            );
          })}
          {found.length === 0 && <div className="empty small">Aucun exercice trouvé. Crée-le avec le bouton du haut.</div>}
        </>
      )}
    </Sheet>
  );
}
