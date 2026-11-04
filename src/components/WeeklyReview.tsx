import { addDays, dayKey, fmtKg, fmtNum, shortDate, weekStart } from '../lib/dates';
import { getData } from '../lib/store';
import { adjustmentFor, getTargets, isSunday, totalsOn, weekAvg, type Profile } from '../lib/nutrition';
import { sessions } from '../lib/coach';
import { getProgram, sessionRecords } from '../lib/workout';
import { exName } from '../lib/program';
import { healthBetween } from '../lib/health';
import { Icon, Sheet } from './ui';

export default function WeeklyReview({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const today = dayKey();
  const monday = isSunday(today) ? weekStart(today) : addDays(weekStart(today), -7);
  const sunday = addDays(monday, 6);
  const profile = getData<Profile>('profile')!;
  const targets = getTargets();
  const program = getProgram();

  const week = sessions().filter((s) => s.data.endedAt && s.data.date >= monday && s.data.date <= sunday);
  const planned = program?.days.length ?? 0;
  const records = week.flatMap((s) => sessionRecords(s.id, s.data));

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => d <= today);
  const logged = days.map((d) => totalsOn(d)).filter((t) => t.k > 0);
  const avgK = logged.length ? logged.reduce((a, b) => a + b.k, 0) / logged.length : 0;
  const avgP = logged.length ? logged.reduce((a, b) => a + b.p, 0) / logged.length : 0;

  const a0 = weekAvg(monday);
  const a1 = weekAvg(addDays(monday, -7));
  const a2 = weekAvg(addDays(monday, -14));
  const g0 = a0 !== undefined && a1 !== undefined ? a0 - a1 : undefined;
  const g1 = a1 !== undefined && a2 !== undefined ? a1 - a2 : undefined;
  const adj = adjustmentFor(profile.goal, g0, g1);
  const sign = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'always' });

  return (
    <Sheet open={open} onClose={onClose} title={`Bilan du ${shortDate(monday)} au ${shortDate(sunday)}`}>
      <div className="fields-2">
        <div className="card col" style={{ gap: 2, background: 'var(--card2)', boxShadow: 'none' }}>
          <span className="tiny muted">Séances</span>
          <span className="big-num">
            {week.length}
            <span className="muted" style={{ fontSize: 17 }}> / {planned}</span>
          </span>
        </div>
        <div className="card col" style={{ gap: 2, background: 'var(--card2)', boxShadow: 'none' }}>
          <span className="tiny muted">Poids moyen</span>
          <span className="big-num">{a0 !== undefined ? fmtKg(a0) : '—'}</span>
          {g0 !== undefined && <span className="tiny muted">{sign(g0)} kg sur la semaine</span>}
        </div>
        <div className="card col" style={{ gap: 2, background: 'var(--card2)', boxShadow: 'none' }}>
          <span className="tiny muted">Calories par jour</span>
          <span className="big-num">{logged.length ? fmtNum(avgK) : '—'}</span>
          {targets && <span className="tiny muted">objectif {fmtNum(targets.kcal)}</span>}
        </div>
        <div className="card col" style={{ gap: 2, background: 'var(--card2)', boxShadow: 'none' }}>
          <span className="tiny muted">Protéines par jour</span>
          <span className="big-num">{logged.length ? Math.round(avgP) + ' g' : '—'}</span>
          {targets && <span className="tiny muted">objectif {targets.p} g</span>}
        </div>
      </div>

      {(() => {
        const h = healthBetween(monday, sunday);
        const kcal = h.reduce((a, b) => a + (b.kcal ?? 0), 0);
        if (h.length === 0) return null;
        return (
          <div className="card row" style={{ background: 'var(--sky-tint)', boxShadow: 'none' }}>
            <Icon name="flame" style={{ color: 'var(--sky-ink)' }} />
            <span className="small" style={{ color: 'var(--sky-ink)', fontWeight: 600 }}>
              {fmtNum(kcal)} kcal brûlées pendant tes activités cette semaine ({h.length} enregistrée{h.length > 1 ? 's' : ''} par ta montre)
            </span>
          </div>
        );
      })()}

      {records.length > 0 && (
        <div className="card col" style={{ gap: 6, background: 'var(--brand-tint)', boxShadow: 'none' }}>
          <span className="row small" style={{ gap: 8, fontWeight: 700, color: 'var(--brand-deep)' }}>
            <Icon name="trophy" size={18} />
            {records.length} record{records.length > 1 ? 's' : ''} cette semaine
          </span>
          {records.slice(0, 5).map((r, i) => (
            <span key={i} className="small" style={{ color: 'var(--brand-deep)' }}>
              {exName(r.key)} : {r.w} kg × {r.r}
            </span>
          ))}
        </div>
      )}

      <div className="card col" style={{ gap: 6 }}>
        <span style={{ fontWeight: 700 }}>Pour la semaine prochaine</span>
        <span className="small" style={{ lineHeight: 1.45 }}>
          {a0 === undefined
            ? 'Pèse-toi au moins 3 matins par semaine pour qu’Élan puisse ajuster tes calories.'
            : adj
              ? `${adj.reason} ${targets?.mode === 'auto' ? 'Élan l’appliquera lundi.' : 'Tu es en mode manuel : à toi de voir dans les réglages.'}`
              : 'Ton rythme est bon : on garde les mêmes calories.'}
        </span>
        {logged.length < days.length && (
          <span className="small muted">
            {days.length - logged.length} jour{days.length - logged.length > 1 ? 's' : ''} sans repas noté cette semaine.
          </span>
        )}
      </div>
    </Sheet>
  );
}
