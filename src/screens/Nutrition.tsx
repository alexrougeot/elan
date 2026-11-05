import { useEffect, useMemo, useRef, useState } from 'react';
import { allOf, getData, getDoc, putDoc, removeDoc, uid, useStoreVersion } from '../lib/store';
import { addDays, dayKey, fmtNum, hhmm, longDate } from '../lib/dates';
import { currentWeight, entryMacros, foodsOn, getTargets, mealTarget, sum, totalsOn, type FoodEntry, type Macros, type Profile } from '../lib/nutrition';
import { dayBonus } from '../lib/activity';
import { forgetFood, isMine, loadCiqual, offProduct, offSearch, rememberFood, searchCiqual, searchMine, myFoods, setUnitWeight, type FoodItem, type MyFood } from '../lib/foods';
import { currentSubscription, enablePush, pushSupported } from '../lib/push';
import { haptic, isIOS, isStandalone, useOnline } from '../lib/device';
import { countText, guessUnit, plural, portionsFor, type Portion, type PortionChoice } from '../lib/portions';
import { mealIdea, mealKind } from '../lib/mealIdeas';
import { HeroLeaves, Icon, Ring, Sheet, Stepper, mealVisual, showToast } from '../components/ui';

type FavMeal = { name: string; items: (FoodItem & { grams: number; portion?: FoodEntry['portion'] })[] };

export default function Nutrition() {
  useStoreVersion();
  const [date, setDate] = useState(dayKey());
  const targets = getTargets();
  const totals = totalsOn(date);
  const entries = foodsOn(date);
  const [adding, setAdding] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [idea, setIdea] = useState<number | null>(null);
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  const isToday = date === dayKey();

  useEffect(() => {
    void loadCiqual().catch(() => {});
    currentSubscription()
      .then((s) => setPushOn(!!s))
      .catch(() => setPushOn(false));
  }, []);

  if (!targets) return null;
  const profile = getData<Profile>('profile');
  const extra = dayBonus(date, profile?.goal ?? 'masse', currentWeight(profile));
  const dayT = { ...targets, kcal: targets.kcal + extra.bonus, g: targets.g + Math.round(extra.bonus / 4) };
  const left = dayT.kcal - totals.k;

  async function copyYesterday(meal: number) {
    const y = foodsOn(addDays(date, -1)).filter((f) => f.data.meal === meal);
    if (y.length === 0) {
      showToast('Rien de noté pour ce repas hier.');
      return;
    }
    haptic();
    for (const f of y) await putDoc('food:' + uid(), 'food', { ...f.data, date, at: new Date().toISOString() });
    showToast(`${y.length} aliment${y.length > 1 ? 's' : ''} repris d’hier`);
  }

  async function saveFavorite(meal: number) {
    const items = entries.filter((f) => f.data.meal === meal);
    if (items.length === 0) return;
    haptic();
    const fav: FavMeal = {
      name: `${targets!.meals[meal].name} · ${items.map((i) => i.data.name.split(',')[0]).slice(0, 2).join(', ')}`,
      items: items.map((i) => ({ name: i.data.name, brand: i.data.brand, per100: i.data.per100, src: i.data.src, ref: i.data.ref ?? 'perso:' + uid(), grams: i.data.grams, portion: i.data.portion })),
    };
    await putDoc('favmeal:' + uid(), 'favmeal', fav);
    showToast('Repas ajouté à tes favoris');
  }

  async function turnOnPush() {
    const r = await enablePush();
    if (r === 'ok') {
      setPushOn(true);
      showToast('Rappels de repas activés');
    } else if (r === 'denied') showToast('Notifications refusées. Autorise-les dans Réglages, Notifications, Élan.', undefined, 6000);
    else if (r === 'unsupported') showToast('Installe d’abord Élan sur l’écran d’accueil pour recevoir les rappels.', undefined, 6000);
    else showToast('Impossible d’activer les rappels pour l’instant. Réessaie avec du réseau.');
  }

  const canPush = pushSupported() && (!isIOS() || isStandalone());

  return (
    <main className="screen">
      <header className="screen-head">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{isToday ? 'Aujourd’hui' : longDate(date)}</span>
          <h1 className="title">Nutrition</h1>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn press" aria-label="Jour précédent" onClick={() => setDate(addDays(date, -1))}>
            <Icon name="left" />
          </button>
          <button className="icon-btn press" aria-label="Jour suivant" disabled={isToday} style={{ opacity: isToday ? 0.4 : 1 }} onClick={() => !isToday && setDate(addDays(date, 1))}>
            <Icon name="right" />
          </button>
        </div>
      </header>

      <section className="hero col" style={{ gap: 16 }}>
        <HeroLeaves />
        <div className="row" style={{ gap: 18 }}>
          <Ring value={totals.k / dayT.kcal} size={108} stroke={13} color={left < -150 ? '#FCD34D' : '#BEF264'} track="rgba(255,255,255,0.18)" label={`${fmtNum(Math.abs(left))} kilocalories ${left >= 0 ? 'restantes' : 'en trop'}`}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>{fmtNum(Math.abs(left))}</span>
            <span className="tiny on-hero-2">{left >= 0 ? 'kcal restantes' : 'kcal en trop'}</span>
          </Ring>
          <div className="col" style={{ gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{fmtNum(totals.k)} kcal mangées</span>
            <span className="small on-hero-2">Objectif : {fmtNum(dayT.kcal)} kcal</span>
            {extra.bonus > 0 && (
              <span className="hero-chip" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                <Icon name="flame" size={14} />+{extra.bonus} kcal d’entraînement ({extra.fromWatch ? 'montre' : 'estimé'})
              </span>
            )}
            {targets.history.filter((h) => !h.undone).slice(-1).map((h) => (
              <span key={h.date} className="hero-chip" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                Ajusté le {new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : {h.delta > 0 ? '+' : ''}
                {h.delta} kcal
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {[
            ['Protéines', totals.p, dayT.p, '#A7F3D0'],
            ['Glucides', totals.g, dayT.g, '#BEF264'],
            ['Lipides', totals.l, dayT.l, '#FCD34D'],
          ].map(([l, v, t, c]) => (
            <div key={l as string} className="col" style={{ gap: 4 }}>
              <span className="tiny on-hero-2">{l as string}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>
                {Math.round(v as number)} / {t as number} g
              </span>
              <div className="bar" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <div style={{ width: Math.min(100, ((v as number) / (t as number)) * 100) + '%', background: c as string }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {pushOn === false && canPush && (
        <button className="card press row" style={{ border: 'none', textAlign: 'left', background: 'var(--brand-tint)', boxShadow: 'none' }} onClick={turnOnPush}>
          <Icon name="bell" style={{ color: 'var(--brand-ink)' }} />
          <div className="grow col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700, color: 'var(--brand-deep)' }}>Activer les rappels de repas</span>
            <span className="small" style={{ color: 'var(--brand-deep)' }}>
              Une notification à chaque repas, avec les quantités.
            </span>
          </div>
        </button>
      )}
      {pushOn === false && isIOS() && !isStandalone() && (
        <div className="card row small" style={{ alignItems: 'flex-start' }}>
          <Icon name="share" style={{ color: 'var(--brand-ink)' }} />
          <span>
            Pour recevoir les rappels de repas, installe Élan : bouton <b>Partager</b> de Safari, puis <b>Sur l’écran d’accueil</b>.
          </span>
        </div>
      )}

      {targets.meals.map((m, i) => {
        const items = entries.filter((f) => f.data.meal === i);
        const got = sum(items.map((f) => entryMacros(f.data)));
        const tgt = mealTarget(targets, i);
        return (
          <section key={i} className="card col" style={{ gap: 10 }}>
            <div className="row">
              <span className={'tile ' + mealVisual(m.name, m.time).tint}>
                <Icon name={mealVisual(m.name, m.time).icon} />
              </span>
              <div className="grow col" style={{ gap: 1 }}>
                <span className="tiny muted" style={{ fontWeight: 600 }}>
                  {hhmm(m.time)}
                </span>
                <h2 className="h2">{m.name}</h2>
              </div>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {fmtNum(got.k)} <span className="muted small">/ {tgt.k} kcal</span>
              </span>
            </div>
            <div className="progress-line" style={{ height: 5 }}>
              <div style={{ width: Math.min(100, (got.k / (tgt.k || 1)) * 100) + '%' }} />
            </div>
            <span className="tiny muted">
              Protéines {Math.round(got.p)}/{tgt.p} g · Glucides {Math.round(got.g)}/{tgt.g} g · Lipides {Math.round(got.l)}/{tgt.l} g
            </span>
            {items.length === 0 && m.hint && <span className="small muted">{m.hint}</span>}
            {items.length > 0 && (
              <div className="col" style={{ gap: 0, margin: '0 -10px' }}>
                {items.map((f) => (
                  <button key={f.id} className="list-row press" style={{ minHeight: 48, padding: '6px 10px' }} onClick={() => setEditing(f.id)}>
                    <div className="grow col" style={{ gap: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.data.name}</span>
                      <span className="tiny muted">
                        {f.data.portion ? countText(f.data.portion.count, f.data.portion) + ' · ' : ''}
                        {f.data.grams} g{f.data.brand ? ' · ' + f.data.brand : ''}
                      </span>
                    </div>
                    <span className="small" style={{ fontWeight: 600 }}>
                      {fmtNum(entryMacros(f.data).k)} kcal
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="chip press" style={{ background: 'var(--ink)', color: 'var(--bg)', borderColor: 'var(--ink)' }} onClick={() => setAdding(i)}>
                <Icon name="plus" size={16} />
                Ajouter
              </button>
              <button className="chip press" onClick={() => setIdea(i)} aria-label="Je mange quoi ?">
                <Icon name="idea" size={16} />
                Idée
              </button>
              <button className="chip press" onClick={() => copyYesterday(i)} aria-label="Comme hier">
                <Icon name="copy" size={16} />
                Hier
              </button>
              {items.length > 0 && (
                <button className="chip press" style={{ width: 44, justifyContent: 'center', padding: 0 }} onClick={() => saveFavorite(i)} aria-label="Enregistrer ce repas en favori">
                  <Icon name="star" size={17} />
                </button>
              )}
            </div>
          </section>
        );
      })}

      <p className="tiny muted" style={{ margin: '4px 4px 0', lineHeight: 1.5 }}>
        Aliments frais : table Ciqual de l’Anses. Produits scannés : Open Food Facts.
      </p>

      <AddFoodSheet date={date} meal={adding} onClose={() => setAdding(null)} />
      <EditEntrySheet id={editing} onClose={() => setEditing(null)} />
      <IdeaSheet date={date} meal={idea} onClose={() => setIdea(null)} />
    </main>
  );
}

// ---------------- Ajouter un aliment ----------------
type Qty = { grams: number; portion?: PortionChoice };

function AddFoodSheet({ date, meal, onClose }: { date: string; meal: number | null; onClose: () => void }) {
  const targets = getTargets();
  const isOnline = useOnline();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [scan, setScan] = useState(false);
  const [creating, setCreating] = useState<{ code?: string; edit?: FoodItem } | null>(null);
  const [online, setOnline] = useState<{ q: string; items: FoodItem[] } | null>(null);
  const [onlineState, setOnlineState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [ciqualReady, setCiqualReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const storeV = useStoreVersion();

  useEffect(() => {
    if (meal === null) return;
    setQ('');
    setPicked(null);
    setScan(false);
    setCreating(null);
    setOnline(null);
    loadCiqual()
      .then(() => setCiqualReady(true))
      .catch(() => {});
  }, [meal]);

  // Recherche en ligne automatique dès qu'il y a du réseau
  useEffect(() => {
    const query = q.trim();
    if (meal === null || query.length < 3 || !isOnline) {
      setOnlineState('idle');
      return;
    }
    if (online?.q === query) return;
    let alive = true;
    setOnlineState('loading');
    const t = setTimeout(async () => {
      try {
        const items = await offSearch(query);
        if (!alive) return;
        setOnline({ q: query, items });
        setOnlineState('idle');
      } catch {
        if (alive) setOnlineState('error');
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, isOnline, meal, retry]);

  const mine = useMemo(() => (q.trim() ? searchMine(q) : myFoods()).slice(0, 25), [q, meal, picked, storeV]);
  const ciq = useMemo(() => (q.trim().length >= 2 && ciqualReady ? searchCiqual(q) : []), [q, ciqualReady]);
  const favs = allOf<FavMeal>('favmeal');
  const onlineItems = online && online.q === q.trim() ? online.items.filter((x) => !mine.some((m) => m.ref === x.ref)) : [];

  async function forget(f: FoodItem) {
    haptic();
    const prev = await forgetFood(f.ref);
    setPicked(null);
    showToast(`${f.name} supprimé de tes aliments`, prev ? { label: 'Annuler', run: () => void putDoc('myfood:' + f.ref, 'myfood', prev) } : undefined);
  }

  async function add(item: FoodItem, qty: Qty) {
    if (meal === null) return;
    haptic();
    const e: FoodEntry = {
      date,
      meal,
      name: item.name,
      brand: item.brand,
      grams: qty.grams,
      per100: item.per100,
      src: item.src,
      ref: item.ref,
      portion: qty.portion,
      at: new Date().toISOString(),
    };
    await putDoc('food:' + uid(), 'food', e);
    await rememberFood(item, qty.grams, qty.portion ? { one: qty.portion.one, count: qty.portion.count } : undefined);
    showToast(`${qty.portion ? countText(qty.portion.count, qty.portion) + ' · ' : ''}${item.name.split(',')[0]} ajouté`);
    onClose();
  }

  async function addFav(f: FavMeal) {
    if (meal === null) return;
    haptic();
    for (const it of f.items) {
      await putDoc('food:' + uid(), 'food', {
        date,
        meal,
        name: it.name,
        brand: it.brand,
        grams: it.grams,
        per100: it.per100,
        src: it.src,
        ref: it.ref,
        portion: it.portion,
        at: new Date().toISOString(),
      } as FoodEntry);
    }
    showToast('Repas favori ajouté');
    onClose();
  }

  const title = meal !== null && targets ? `Ajouter · ${targets.meals[meal].name}` : 'Ajouter';
  const query = q.trim();

  return (
    <Sheet open={meal !== null} onClose={onClose} title={title} full>
      {picked ? (
        <QuantityPanel
          key={picked.ref + JSON.stringify(picked.unit ?? null)}
          item={picked}
          onBack={() => setPicked(null)}
          onConfirm={(qty) => add(picked, qty)}
          cta="Ajouter"
          onForget={isMine(picked.ref) ? () => void forget(picked) : undefined}
          onEditFood={picked.src === 'perso' ? () => {
            setCreating({ edit: picked });
            setPicked(null);
          } : undefined}
        />
      ) : scan ? (
        <Scanner
          onCancel={() => setScan(false)}
          onFound={(item) => {
            setScan(false);
            setPicked(item);
          }}
          onUnknown={(code) => {
            setScan(false);
            setCreating({ code });
          }}
        />
      ) : creating ? (
        <CustomFoodForm
          code={creating.code}
          initial={creating.edit}
          onCancel={() => setCreating(null)}
          onSaved={(item) => {
            setCreating(null);
            setPicked(item);
          }}
        />
      ) : (
        <>
          <div className="row" style={{ gap: 8 }}>
            <label className="grow" style={{ position: 'relative' }}>
              <span className="sr-only">Chercher un aliment</span>
              <Icon name="search" size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ink3)' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Œuf, riz, skyr, une marque…" style={{ paddingLeft: 38 }} enterKeyHint="search" />
            </label>
            <button className="icon-btn press" style={{ background: 'var(--ink)', color: 'var(--bg)' }} aria-label="Scanner un code-barres" onClick={() => setScan(true)}>
              <Icon name="scan" />
            </button>
          </div>
          {!isOnline && (
            <div className="row tiny muted" style={{ gap: 6 }}>
              <Icon name="offline" size={16} />
              Pas de réseau : recherche dans les aliments de base et les tiens. Les produits du commerce reviendront avec le réseau.
            </div>
          )}

          {!query && favs.length > 0 && (
            <div className="col" style={{ gap: 6 }}>
              <span className="small muted" style={{ fontWeight: 600 }}>
                Repas favoris
              </span>
              {favs.map((f) => {
                const k = sum(f.data.items.map((x) => entryMacros(x))).k;
                return (
                  <div key={f.id} className="row" style={{ gap: 6 }}>
                    <button className="list-row press grow" style={{ background: 'var(--card2)' }} onClick={() => addFav(f.data)}>
                      <Icon name="star" size={18} style={{ color: 'var(--amber)' }} />
                      <div className="grow col" style={{ gap: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{f.data.name}</span>
                        <span className="tiny muted">
                          {f.data.items.length} aliments · {fmtNum(k)} kcal
                        </span>
                      </div>
                    </button>
                    <button className="icon-btn plain press" aria-label="Supprimer ce favori" onClick={() => removeDoc(f.id)}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {mine.length > 0 && <FoodList title={query ? 'Mes aliments' : 'Récents'} items={mine} onPick={setPicked} onForget={forget} />}
          {ciq.length > 0 && <FoodList title="Aliments de base" items={ciq} onPick={setPicked} />}
          {query.length >= 3 && isOnline && (
            <>
              {onlineState === 'loading' && <div className="small muted" style={{ padding: '4px 0' }}>Recherche dans les produits du commerce…</div>}
              {onlineState === 'error' && (
                <div className="row small" style={{ gap: 8, justifyContent: 'space-between' }}>
                  <span className="muted">Open Food Facts ne répond pas pour l’instant.</span>
                  <button className="chip press" onClick={() => setRetry((r) => r + 1)}>
                    Réessayer
                  </button>
                </div>
              )}
              {onlineItems.length > 0 && <FoodList title="Produits du commerce" items={onlineItems} onPick={setPicked} />}
            </>
          )}
          {query.length >= 2 && ciq.length === 0 && mine.length === 0 && onlineItems.length === 0 && onlineState !== 'loading' && ciqualReady && (
            <div className="empty">Rien trouvé pour « {q} ». Essaie un autre mot ou scanne le code-barres.</div>
          )}

          <button className="btn ghost press" onClick={() => setCreating({})}>
            <Icon name="edit" size={18} />
            Créer un aliment
          </button>
        </>
      )}
    </Sheet>
  );
}

function FoodList({ title, items, onPick, onForget }: { title: string; items: FoodItem[]; onPick: (f: FoodItem) => void; onForget?: (f: FoodItem) => void }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <span className="small muted" style={{ fontWeight: 600 }}>
        {title}
      </span>
      <div className="col" style={{ gap: 0, margin: '0 -12px' }}>
        {items.map((f) => {
          const por = portionsFor(f.name, f.serving, f.unit, (f as MyFood).units)[0];
          const k1 = por ? Math.round((f.per100.k * por.grams) / 100) : null;
          return (
            <div key={f.ref + f.name} className="row" style={{ gap: 0 }}>
            <button className="list-row press grow" onClick={() => onPick(f)}>
              {f.image ? <img src={f.image} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover', flex: 'none', background: 'var(--line2)' }} /> : null}
              <div className="grow col" style={{ gap: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{f.name}</span>
                <span className="tiny muted">
                  {f.brand ? f.brand + ' · ' : ''}
                  {por ? `1 ${por.one} ≈ ${k1} kcal` : `${Math.round(f.per100.k)} kcal pour 100 g`} · P {f.per100.p.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} G{' '}
                  {f.per100.g.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L {f.per100.l.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} /100 g
                </span>
              </div>
            </button>
            {onForget && (
              <button className="icon-btn plain press" style={{ marginRight: 4 }} aria-label={`Supprimer ${f.name} de mes aliments`} onClick={() => onForget(f)}>
                <Icon name="trash" size={18} />
              </button>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Poids au gramme près : on tape la valeur, ou on ajuste de 1 ou 10 g */
function GramsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    const n = Number(text.replace(',', '.'));
    if (n !== value) setText(String(value).replace('.', ','));
  }, [value]);
  const set = (v: number) => onChange(Math.max(1, Math.round(v * 10) / 10));
  const step = (d: number) => (
    <button className="chip press" style={{ minWidth: 46, justifyContent: 'center', fontWeight: 700 }} onClick={() => set(value + d)} aria-label={`${d > 0 ? 'Plus' : 'Moins'} ${Math.abs(d)} g`}>
      {d > 0 ? '+' : '−'}
      {Math.abs(d)}
    </button>
  );
  return (
    <div className="row" style={{ gap: 6, justifyContent: 'center', alignItems: 'center' }}>
      {step(-10)}
      {step(-1)}
      <label className="grams-field">
        <input
          inputMode="decimal"
          enterKeyHint="done"
          aria-label="Poids en grammes"
          value={text}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.,]/g, '');
            setText(v);
            const n = Number(v.replace(',', '.'));
            if (n > 0) onChange(Math.round(n * 10) / 10);
          }}
          onBlur={() => setText(String(value).replace('.', ','))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span>g</span>
      </label>
      {step(1)}
      {step(10)}
    </div>
  );
}

function QuantityPanel({
  item,
  onBack,
  onConfirm,
  cta,
  initial,
  onDelete,
  onForget,
  onEditFood,
}: {
  item: FoodItem;
  onBack?: () => void;
  onConfirm: (q: Qty) => void;
  cta: string;
  initial?: Qty;
  onDelete?: () => void;
  onForget?: () => void;
  onEditFood?: () => void;
}) {
  const mem = getData<MyFood>('myfood:' + item.ref);
  const unitKey = JSON.stringify([item.unit ?? mem?.unit, mem?.units]);
  const portions = useMemo(() => portionsFor(item.name, item.serving ?? mem?.serving, item.unit ?? mem?.unit, mem?.units), [item.name, item.serving, unitKey]);
  const [editUnit, setEditUnit] = useState<number | null>(null);
  const startPortion =
    (initial?.portion && portions.find((p) => p.one === initial.portion!.one)) ||
    (!initial && mem?.lastPortion && portions.find((p) => p.one === mem.lastPortion!.one)) ||
    (!initial || initial.portion ? portions[0] : undefined);
  const [mode, setMode] = useState<'unit' | 'g'>(startPortion ? 'unit' : 'g');
  const [por, setPor] = useState<Portion | undefined>(startPortion);
  const [count, setCount] = useState(initial?.portion?.count ?? (!initial && mem?.lastPortion && startPortion?.one === mem.lastPortion.one ? mem.lastPortion.count : 1));
  const [g, setG] = useState(initial?.grams ?? mem?.lastGrams ?? item.serving ?? 100);

  const grams = mode === 'unit' && por ? Math.round(por.grams * count) : g;
  const m: Macros = entryMacros({ grams, per100: item.per100 });
  const chips = [...new Set([item.serving, mem?.lastGrams, 50, 100, 150, 200, 250].filter((x): x is number => !!x))].slice(0, 6);

  function confirm() {
    if (mode === 'unit' && por) onConfirm({ grams, portion: { ...por, count } });
    else onConfirm({ grams: g });
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row" style={{ gap: 10 }}>
        {onBack && (
          <button className="icon-btn press" aria-label="Retour" onClick={onBack}>
            <Icon name="left" />
          </button>
        )}
        <div className="grow col" style={{ gap: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{item.name}</span>
          <span className="tiny muted">{item.brand ?? (item.src === 'ciqual' ? 'Table Ciqual' : item.src === 'off' ? 'Open Food Facts' : 'Mon aliment')}</span>
        </div>
      </div>

      {portions.length > 0 && (
        <div className="segmented" role="group" aria-label="Unité">
          <button aria-pressed={mode === 'unit'} onClick={() => setMode('unit')}>
            En {(por ?? portions[0]).many}
          </button>
          <button
            aria-pressed={mode === 'g'}
            onClick={() => {
              if (mode === 'unit') setG(grams);
              setMode('g');
            }}
          >
            En grammes
          </button>
        </div>
      )}

      {mode === 'unit' && por ? (
        <>
          {portions.length > 1 && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {portions.map((p) => (
                <button key={p.one} className={'chip press' + (p.one === por.one ? ' on' : '')} onClick={() => setPor(p)}>
                  1 {p.one} ({p.grams} g)
                </button>
              ))}
            </div>
          )}
          <div className="stepper">
            <button className="press" aria-label="Moins" onClick={() => setCount(Math.max(0.5, count >= 1.5 ? count - 1 : 0.5))}>
              <Icon name="minus" size={24} />
            </button>
            <output aria-live="polite" style={{ fontSize: 30, lineHeight: 1.15 }}>
              {countText(count, por)}
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink2)', marginTop: 2 }}>soit {grams} g</span>
            </output>
            <button className="press" aria-label="Plus" onClick={() => setCount(count < 1 ? 1 : count + 1)}>
              <Icon name="plus" size={24} />
            </button>
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            {[0.5, 1, 1.5, 2, 3, 4].map((c) => (
              <button key={c} className={'chip press' + (c === count ? ' on' : '')} onClick={() => setCount(c)} style={{ minWidth: 48, justifyContent: 'center' }}>
                {c === 0.5 ? '½' : c === 1.5 ? '1½' : c}
              </button>
            ))}
          </div>
          {editUnit === null ? (
            <div className="row small" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span className="muted">
                1 {por.one} = {por.grams} g
              </span>
              <button className="chip press" onClick={() => setEditUnit(por.grams)}>
                <Icon name="edit" size={14} />
                Modifier
              </button>
            </div>
          ) : (
            <div className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none', alignItems: 'center' }}>
              <span className="small" style={{ fontWeight: 650 }}>
                Chez toi, 1 {por.one} pèse :
              </span>
              <GramsInput value={editUnit} onChange={setEditUnit} />
              <div className="row" style={{ gap: 8 }}>
                <button className="chip press" onClick={() => setEditUnit(null)}>
                  Annuler
                </button>
                <button
                  className="chip press on"
                  onClick={async () => {
                    await setUnitWeight(item, por.one, editUnit);
                    setPor({ ...por, grams: editUnit });
                    setEditUnit(null);
                    showToast(`C’est noté : 1 ${por.one} = ${editUnit} g`);
                  }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <GramsInput value={g} onChange={setG} />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {chips.map((c) => (
              <button key={c} className={'chip press' + (c === g ? ' on' : '')} onClick={() => setG(c)}>
                {c} g{c === item.serving ? ' (portion)' : ''}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="card" style={{ background: 'var(--card2)', boxShadow: 'none', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', textAlign: 'center', gap: 4 }}>
        {[
          ['kcal', m.k, ''],
          ['Prot.', m.p, ' g'],
          ['Gluc.', m.g, ' g'],
          ['Lip.', m.l, ' g'],
        ].map(([l, v, u]) => (
          <div key={l as string} className="col" style={{ gap: 2 }}>
            <span style={{ fontSize: 19, fontWeight: 700 }}>
              {Math.round(v as number)}
              {u as string}
            </span>
            <span className="tiny muted">{l as string}</span>
          </div>
        ))}
      </div>
      <button className="btn brand press" onClick={confirm}>
        {cta}
      </button>
      {onDelete && (
        <button className="btn danger press" onClick={onDelete}>
          <Icon name="trash" size={18} />
          Retirer
        </button>
      )}
      {(onEditFood || onForget) && (
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          {onEditFood && (
            <button className="chip press" onClick={onEditFood}>
              <Icon name="edit" size={15} />
              Modifier l’aliment
            </button>
          )}
          {onForget && (
            <button className="chip press" onClick={onForget}>
              <Icon name="trash" size={15} />
              Supprimer de mes aliments
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EditEntrySheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const doc = id ? getDoc<FoodEntry>(id) : undefined;
  return (
    <Sheet open={!!doc} onClose={onClose} title="Quantité">
      {doc && (
        <QuantityPanel
          key={doc.id}
          item={{ name: doc.data.name, brand: doc.data.brand, per100: doc.data.per100, src: doc.data.src, ref: doc.data.ref ?? doc.id }}
          initial={{ grams: doc.data.grams, portion: doc.data.portion }}
          cta="Enregistrer"
          onConfirm={async (qty) => {
            await putDoc(doc.id, 'food', { ...doc.data, grams: qty.grams, portion: qty.portion });
            onClose();
          }}
          onDelete={async () => {
            haptic();
            await removeDoc(doc.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

// ---------------- Scanner de codes-barres ----------------
function Scanner({ onCancel, onFound, onUnknown }: { onCancel: () => void; onFound: (f: FoodItem) => void; onUnknown: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'scanning' | 'looking' | 'error'>('starting');
  const [msg, setMsg] = useState('');
  const [manual, setManual] = useState('');

  async function lookup(code: string) {
    setState('looking');
    const known = getData<MyFood>('myfood:off:' + code);
    if (known) {
      onFound(known);
      return;
    }
    try {
      const r = await offProduct(code);
      if (r && r !== 'incomplete') onFound(r);
      else onUnknown(code);
    } catch {
      setState('error');
      setMsg(
        navigator.onLine
          ? 'Open Food Facts ne répond pas pour l’instant. Réessaie dans un moment, ou tape le code-barres.'
          : 'Pas de réseau : impossible de trouver ce produit. Si tu l’as déjà scanné, il est dans tes récents.'
      );
    }
  }

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let done = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        if (!video.current) return;
        controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, (result) => {
          if (result && !done) {
            done = true;
            haptic();
            controls?.stop();
            void lookup(result.getText());
          }
        });
        setState('scanning');
      } catch (e) {
        setState('error');
        setMsg((e as Error).name === 'NotAllowedError' ? 'L’accès à l’appareil photo est refusé. Autorise-le dans Réglages, Safari (ou Élan), Appareil photo.' : 'Impossible d’ouvrir l’appareil photo.');
      }
    })();
    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="col" style={{ gap: 14 }}>
      <div style={{ position: 'relative' }}>
        <video ref={video} className="scanner-video" playsInline muted autoPlay />
        <div aria-hidden="true" style={{ position: 'absolute', left: '12%', right: '12%', top: '40%', height: '20%', borderRadius: 14, boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 9999px rgba(0,0,0,0.35)' }} />
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: 600 }}>
          {state === 'looking' ? 'Recherche du produit…' : state === 'scanning' ? 'Vise le code-barres' : state === 'starting' ? 'Ouverture de l’appareil photo…' : ''}
        </span>
      </div>
      {state === 'error' && (
        <p role="alert" className="small" style={{ margin: 0, color: 'var(--red)' }}>
          {msg}
        </p>
      )}
      <form
        className="row"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim().length >= 8) void lookup(manual.trim());
        }}
      >
        <label className="grow">
          <span className="sr-only">Code-barres</span>
          <input inputMode="numeric" placeholder="Ou tape le code-barres" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
        </label>
        <button className="btn small press" disabled={manual.length < 8}>
          OK
        </button>
      </form>
      <button className="btn ghost press" onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}

function CustomFoodForm({ code, initial, onCancel, onSaved }: { code?: string; initial?: FoodItem; onCancel: () => void; onSaved: (f: FoodItem) => void }) {
  const r1 = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
  const u0 = initial?.unit;
  const per = (x: number) => (u0 ? (x * u0.grams) / 100 : x);
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [byUnit, setByUnit] = useState(!!u0);
  const [unitName, setUnitName] = useState(u0?.one ?? '');
  const [unitGrams, setUnitGrams] = useState(u0 && u0.grams !== 100 ? r1(u0.grams) : '');
  const [k, setK] = useState(initial ? r1(per(initial.per100.k)) : '');
  const [p, setP] = useState(initial ? r1(per(initial.per100.p)) : '');
  const [g, setG] = useState(initial ? r1(per(initial.per100.g)) : '');
  const [l, setL] = useState(initial ? r1(per(initial.per100.l)) : '');
  const [serving, setServing] = useState(initial?.serving && !u0 ? r1(initial.serving) : '');
  const n = (s: string) => Number(s.replace(',', '.')) || 0;
  const unit = (unitName.trim() || guessUnit(name) || 'portion').toLowerCase();
  const basis = byUnit ? `pour 1 ${unit}` : 'pour 100 g';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const kcal = n(k) || Math.round(n(p) * 4 + n(g) * 4 + n(l) * 9);
    // à l'unité sans poids connu : on considère qu'une unité « pèse » 100 g
    const w = byUnit ? n(unitGrams) || 100 : 100;
    const f = 100 / w;
    const item: FoodItem = {
      name: name.trim(),
      brand: brand.trim() || undefined,
      per100: { k: Math.round(kcal * f * 10) / 10, p: n(p) * f, g: n(g) * f, l: n(l) * f },
      src: 'perso',
      ref: initial?.ref ?? (code ? 'off:' + code : 'perso:' + uid()),
      serving: byUnit ? w : n(serving) || undefined,
      unit: byUnit ? { one: unit, many: plural(unit), grams: w } : undefined,
    };
    await rememberFood(item);
    showToast(initial ? 'Aliment modifié' : 'Aliment créé');
    onSaved(item);
  }

  return (
    <form className="col" style={{ gap: 14 }} onSubmit={save}>
      {code && (
        <p className="small muted" style={{ margin: 0 }}>
          Produit {code} inconnu ou incomplet. Recopie les valeurs de l’étiquette : la prochaine fois, le scan le retrouvera même sans réseau.
        </p>
      )}
      <label className="field">
        <span>Nom</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : œuf plat, galette maison…" />
      </label>
      <label className="field">
        <span>Marque (facultatif)</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <div className="col" style={{ gap: 6 }}>
        <span className="small muted" style={{ fontWeight: 600 }}>
          Les valeurs que tu as
        </span>
        <div className="segmented" role="group" aria-label="Valeurs pour">
          <button type="button" aria-pressed={!byUnit} onClick={() => setByUnit(false)}>
            Pour 100 g
          </button>
          <button type="button" aria-pressed={byUnit} onClick={() => setByUnit(true)}>
            Pour 1 unité
          </button>
        </div>
      </div>
      {byUnit && (
        <div className="fields-2">
          <label className="field">
            <span>L’unité</span>
            <input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder={guessUnit(name)} />
          </label>
          <label className="field">
            <span>Poids d’une unité (g)</span>
            <input inputMode="decimal" value={unitGrams} onChange={(e) => setUnitGrams(e.target.value)} placeholder="si tu le sais" />
          </label>
        </div>
      )}
      <div className="fields-2">
        <label className="field">
          <span>Protéines (g {basis})</span>
          <input inputMode="decimal" required value={p} onChange={(e) => setP(e.target.value)} />
        </label>
        <label className="field">
          <span>Glucides (g {basis})</span>
          <input inputMode="decimal" required value={g} onChange={(e) => setG(e.target.value)} />
        </label>
        <label className="field">
          <span>Lipides (g {basis})</span>
          <input inputMode="decimal" required value={l} onChange={(e) => setL(e.target.value)} />
        </label>
        <label className="field">
          <span>Calories ({basis})</span>
          <input inputMode="decimal" placeholder="calculées si vide" value={k} onChange={(e) => setK(e.target.value)} />
        </label>
      </div>
      {!byUnit && (
        <label className="field">
          <span>Portion habituelle en grammes (facultatif)</span>
          <input inputMode="numeric" value={serving} onChange={(e) => setServing(e.target.value)} />
        </label>
      )}
      {byUnit && (
        <p className="tiny muted" style={{ margin: 0 }}>
          Ensuite, tu choisis simplement « 1 {unit} », « 2 {plural(unit)} »… Élan compte les valeurs que tu as mises pour chaque {unit}.
        </p>
      )}
      <button className="btn brand press">{initial ? 'Enregistrer les changements' : 'Enregistrer l’aliment'}</button>
      <button type="button" className="btn ghost press" onClick={onCancel}>
        Annuler
      </button>
    </form>
  );
}

// ---------------- Je mange quoi ? ----------------
function IdeaSheet({ date, meal, onClose }: { date: string; meal: number | null; onClose: () => void }) {
  const targets = getTargets();
  const [variant, setVariant] = useState(0);
  useEffect(() => setVariant(0), [meal]);
  if (meal === null || !targets) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const m = targets.meals[meal];
  const tgt = mealTarget(targets, meal);
  const got = sum(foodsOn(date).filter((f) => f.data.meal === meal).map((f) => entryMacros(f.data)));
  const left = { k: tgt.k - got.k, p: Math.max(0, tgt.p - got.p), g: Math.max(0, tgt.g - got.g), l: Math.max(0, tgt.l - got.l) };
  const idea = mealIdea(mealKind(m.name, m.time), left, variant);

  async function addAll() {
    if (!idea || meal === null) return;
    haptic();
    for (const it of idea.items) {
      await putDoc('food:' + uid(), 'food', {
        date,
        meal,
        name: it.food.name,
        grams: it.grams,
        per100: it.food.per100,
        src: 'ciqual',
        ref: it.food.ref,
        portion: it.portion,
        at: new Date().toISOString(),
      } as FoodEntry);
      await rememberFood(it.food, it.grams, it.portion ? { one: it.portion.one, count: it.portion.count } : undefined);
    }
    showToast('Repas ajouté');
    onClose();
  }

  return (
    <Sheet open={meal !== null} onClose={onClose} title={`Je mange quoi ? · ${m.name}`}>
      {!idea ? (
        <div className="empty">Ce repas est déjà complet. Bien joué !</div>
      ) : (
        <>
          <span className="small muted">
            Il te reste {Math.round(left.k)} kcal pour ce repas : P {Math.round(left.p)} g · G {Math.round(left.g)} g · L {Math.round(left.l)} g. Avec des aliments de base :
          </span>
          <div className="card col" style={{ gap: 10, background: 'var(--card2)', boxShadow: 'none' }}>
            {idea.items.map((it, i) => (
              <div key={i} className="row" style={{ gap: 12 }}>
                <span className="tile sm tint-brand" style={{ fontWeight: 700, fontSize: 14 }}>
                  {i + 1}
                </span>
                <div className="grow col" style={{ gap: 1 }}>
                  <span style={{ fontWeight: 600 }}>{it.text}</span>
                  <span className="tiny muted">{Math.round((it.food.per100.k * it.grams) / 100)} kcal</span>
                </div>
              </div>
            ))}
          </div>
          <div className="row small" style={{ justifyContent: 'space-between' }}>
            <span className="muted">Total</span>
            <span style={{ fontWeight: 700 }}>
              {Math.round(idea.total.k)} kcal · P {Math.round(idea.total.p)} · G {Math.round(idea.total.g)} · L {Math.round(idea.total.l)}
            </span>
          </div>
          <button className="btn brand press" onClick={addAll}>
            Ajouter ce repas
          </button>
          <button className="btn ghost press" onClick={() => setVariant((v) => v + 1)}>
            <Icon name="idea" size={18} />
            Une autre idée
          </button>
          <p className="tiny muted" style={{ margin: 0 }}>
            Poids cuits pour les féculents et les viandes. Tu pourras ajuster chaque aliment après l’ajout.
          </p>
        </>
      )}
    </Sheet>
  );
}
