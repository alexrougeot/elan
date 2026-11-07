// Accueil : un record battu aujourd'hui ou hier, on le dit.
import type { Tab } from '../App';
import { freshRecords } from '../lib/records';
import { nutritionOn } from '../lib/nutrition';
import { Icon } from './ui';

export default function RecordsBanner({ go }: { go: (t: Tab) => void }) {
  const list = freshRecords(2);
  if (!list.length) return null;
  const first = list[0];
  return (
    <button
      className="card press row"
      style={{ border: 'none', textAlign: 'left', background: 'linear-gradient(135deg, #ECFCCB, #D1FAE5)', boxShadow: 'none', color: '#14532D' }}
      onClick={() => go(nutritionOn() ? 'progress' : 'records')}
    >
      <span className="tile" style={{ background: '#BEF264', color: '#14532D' }}>
        <Icon name="trophy" />
      </span>
      <div className="grow col" style={{ gap: 2 }}>
        <span style={{ fontWeight: 700 }}>{list.length > 1 ? `${list.length} nouveaux records !` : 'Nouveau record !'}</span>
        <span className="small" style={{ color: '#166534' }}>
          {first.label} : {first.text}
          {list.length > 1 ? ` · et ${list.length - 1} autre${list.length > 2 ? 's' : ''}` : ''}
        </span>
      </div>
      <Icon name="right" style={{ color: '#166534' }} />
    </button>
  );
}
