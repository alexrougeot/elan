import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { haptic } from '../lib/device';

// ---------- Icônes (trait 2 px, coins ronds) ----------
const PATHS: Record<string, string> = {
  home: 'M4 11 L12 4 L20 11 M6 9.5 V20 H18 V9.5',
  dumbbell: 'M6 7 V17 M3.5 9.5 V14.5 M18 7 V17 M20.5 9.5 V14.5 M6 12 H18',
  fork: 'M7 3 V21 M4 3 V8 A3 3 0 0 0 10 8 V3 M17 21 V3 C14.5 4 14 8 14 12 H17',
  chart: 'M4 19 H20 M5 15 L10 10 L13 13 L19 7 M15 7 H19 V11',
  plus: 'M12 5 V19 M5 12 H19',
  minus: 'M5 12 H19',
  check: 'M5 12.5 L10 17.5 L19 7.5',
  left: 'M15 5 L8 12 L15 19',
  right: 'M9 5 L16 12 L9 19',
  down: 'M5 9 L12 16 L19 9',
  x: 'M6 6 L18 18 M18 6 L6 18',
  bell: 'M6 16 V11 A6 6 0 0 1 18 11 V16 L19.5 18 H4.5 Z M10 21 H14',
  scan: 'M3 7 V4 H6 M18 4 H21 V7 M21 17 V20 H18 M6 20 H3 V17 M7 8 V16 M10 8 V16 M13 8 V16 M17 8 V16',
  star: 'M12 3.5 L14.6 9 L20.5 9.6 L16 13.6 L17.3 19.5 L12 16.5 L6.7 19.5 L8 13.6 L3.5 9.6 L9.4 9 Z',
  copy: 'M9 9 H19 V19 H9 Z M5 15 V5 H15',
  gear: 'M12 9 A3 3 0 1 0 12 15 A3 3 0 1 0 12 9 Z M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7.1 7.1 M16.9 16.9 L18.7 18.7 M5.3 18.7 L7.1 16.9 M16.9 7.1 L18.7 5.3',
  scale: 'M4 5 H20 V19 H4 Z M8.5 10 A3.5 3.5 0 0 1 15.5 10 M12 10 L13.5 8',
  camera: 'M4 8 H7.5 L9 5.5 H15 L16.5 8 H20 V19 H4 Z M12 10 A3.5 3.5 0 1 0 12 17 A3.5 3.5 0 1 0 12 10 Z',
  swap: 'M7 4 L3.5 7.5 L7 11 M3.5 7.5 H17 M17 13 L20.5 16.5 L17 20 M20.5 16.5 H7',
  timer: 'M12 8 V13 L15 15 M9 2.5 H15 M12 5 A8 8 0 1 0 12 21 A8 8 0 1 0 12 5 Z',
  trash: 'M4 7 H20 M9 7 V4.5 H15 V7 M6 7 L7 20 H17 L18 7 M10 11 V16 M14 11 V16',
  kettlebell: 'M8.5 9.6 V7.5 A3.5 3.5 0 0 1 15.5 7.5 V9.6 M12 21 A6 6 0 1 1 12 9 A6 6 0 1 1 12 21 Z',
  trophy: 'M7 4 H17 V9 A5 5 0 0 1 7 9 Z M7 6 H4 A3 3 0 0 0 7 10 M17 6 H20 A3 3 0 0 1 17 10 M12 14 V17 M8 20 H16 M9.5 17 H14.5 V20',
  offline: 'M3 3 L21 21 M8.5 8.5 A6 6 0 0 0 6 13 H6 A4 4 0 0 0 6 21 H18 M11 5.2 A6 6 0 0 1 17.6 10.1 A4 4 0 0 1 21 14.5',
  edit: 'M4 20 H8 L19 9 L15 5 L4 16 Z M13 7 L17 11',
  search: 'M10.5 4 A6.5 6.5 0 1 0 10.5 17 A6.5 6.5 0 1 0 10.5 4 Z M15.5 15.5 L20 20',
  up: 'M12 19 V5 M6 11 L12 5 L18 11',
  arrowDown: 'M12 5 V19 M6 13 L12 19 L18 13',
  share: 'M12 15 V3 M7 8 L12 3 L17 8 M5 12 V20 H19 V12',
  user: 'M12 4 A4 4 0 1 0 12 12 A4 4 0 1 0 12 4 Z M4 21 C5 16.5 8 14.5 12 14.5 C16 14.5 19 16.5 20 21',
  flag: 'M5 21 V4 M5 4 H17 L15 8 L17 12 H5',
  ruler: 'M3 16 L16 3 L21 8 L8 21 Z M7 12 L9 14 M10 9 L12 11 M13 6 L15 8',
  info: 'M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3 Z M12 11 V16 M12 7.5 V8',
  sunrise: 'M3 18 H21 M6.5 18 A5.5 5.5 0 0 1 17.5 18 M12 4 V7 M4.6 9.6 L6.4 11.1 M19.4 9.6 L17.6 11.1 M8 21 H16',
  bolt: 'M13 3 L5 13.5 H11 L10 21 L19 10 H13 Z',
  sun: 'M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8 Z M12 2.5 V4.5 M12 19.5 V21.5 M2.5 12 H4.5 M19.5 12 H21.5 M5.3 5.3 L6.7 6.7 M17.3 17.3 L18.7 18.7 M5.3 18.7 L6.7 17.3 M17.3 6.7 L18.7 5.3',
  apple: 'M12 7.5 C10 6 6 6.5 5.5 10.5 C5 15 8 20.5 10.5 20.5 C11.3 20.5 11.5 20 12 20 C12.5 20 12.7 20.5 13.5 20.5 C16 20.5 19 15 18.5 10.5 C18 6.5 14 6 12 7.5 Z M12 7.5 C12 5.5 13 4 15 3.5',
  moon: 'M20 14.5 A8 8 0 1 1 9.5 4 A6.5 6.5 0 0 0 20 14.5 Z',
  flame: 'M12 21 C8 21 5.5 18.3 5.5 14.8 C5.5 11 8.5 9 9.5 5.5 C11.5 7 12 9 12 10.5 C13.2 9.8 14 8.5 14.2 7 C16.8 9 18.5 11.8 18.5 14.8 C18.5 18.3 16 21 12 21 Z',
  calendar: 'M4 6 H20 V20 H4 Z M4 10 H20 M8 3.5 V7 M16 3.5 V7',
  idea: 'M9 18 H15 M10 21 H14 M12 3 A6 6 0 0 0 8 14 C8.8 14.8 9 15.5 9 16 H15 C15 15.5 15.2 14.8 16 14 A6 6 0 0 0 12 3 Z',
  drop: 'M12 3 C9 7.5 6 10.5 6 14 A6 6 0 0 0 18 14 C18 10.5 15 7.5 12 3 Z',
  heart: 'M12 20 C7 16.5 3.5 13.3 3.5 9.3 A4.3 4.3 0 0 1 12 7.2 A4.3 4.3 0 0 1 20.5 9.3 C20.5 13.3 17 16.5 12 20 Z',
  run: 'M13.5 5.5 A1.8 1.8 0 1 0 13.5 1.9 A1.8 1.8 0 1 0 13.5 5.5 Z M9 21 L11.5 15.5 L14 17.5 V22 M7 11 L10 8 L14 8.5 L16.5 12 L19 12.5 M11.5 15.5 L12.5 10',
  users: 'M9 11 A3.5 3.5 0 1 0 9 4 A3.5 3.5 0 1 0 9 11 Z M2.5 20 C3 16.5 5.5 14.5 9 14.5 C12.5 14.5 15 16.5 15.5 20 M16 11 A3 3 0 1 0 16 5 M18 14.5 C20 15 21.3 17 21.5 20',
};

/** Les feuilles du logo, en motif décoratif */
export function HeroLeaves({ className = 'hero-leaves', color = '#ffffff' }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="4 6 200 200" aria-hidden="true">
      <path d="M100 160 Q102.6 100.9 50 74 Q47.4 133.1 100 160 Z" fill={color} />
      <path d="M100 160 Q161.7 123.5 156 52 Q94.3 88.5 100 160 Z" fill={color} />
    </svg>
  );
}

/** Icône et couleur de chaque repas, selon son heure */
export function mealVisual(name: string, time: string): { icon: string; tint: string } {
  const [h, m] = time.split(':').map(Number);
  const t = h + m / 60;
  if (/séance|seance|sport|training/i.test(name)) return { icon: 'bolt', tint: 'tint-brand' };
  if (t < 10) return { icon: 'sunrise', tint: 'tint-orange' };
  if (t < 14.5) return { icon: 'sun', tint: 'tint-amber' };
  if (t < 18) return { icon: 'apple', tint: 'tint-lime' };
  return { icon: 'moon', tint: 'tint-violet' };
}

const MUSCLE_TINT: Record<string, string> = {
  Pectoraux: 'tint-orange',
  Dos: 'tint-sky',
  Épaules: 'tint-violet',
  Biceps: 'tint-amber',
  Triceps: 'tint-amber',
  Quadriceps: 'tint-brand',
  Ischios: 'tint-lime',
  'Dos et jambes': 'tint-sky',
  'Quadriceps et fessiers': 'tint-brand',
  Fessiers: 'tint-lime',
  Mollets: 'tint-brand',
  Abdos: 'tint-violet',
};
export function muscleTint(muscle?: string) {
  return (muscle && MUSCLE_TINT[muscle]) || 'tint-brand';
}

export function Icon({ name, size = 22, stroke = 2, className, style }: { name: string; size?: number; stroke?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={{ fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', flex: 'none', ...style }}
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

export function LogoMark({ size = 40, tile = true }: { size?: number; tile?: boolean }) {
  const leaves = (
    <>
      <path d="M100 160 Q102.6 100.9 50 74 Q47.4 133.1 100 160 Z" fill="#84CC16" />
      <path d="M100 160 Q161.7 123.5 156 52 Q94.3 88.5 100 160 Z" fill="#10B981" />
    </>
  );
  if (!tile)
    return (
      <svg width={size} height={size} viewBox="4 6 200 200" role="img" aria-label="Élan">
        {leaves}
      </svg>
    );
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.27, background: '#0F172A', display: 'inline-flex', flex: 'none' }}>
      <svg width={size} height={size} viewBox="-26 -24 260 260" role="img" aria-label="Élan">
        {leaves}
      </svg>
    </span>
  );
}

// ---------- Anneau de progression ----------
export function Ring({
  value,
  size = 112,
  stroke = 12,
  color = 'var(--brand)',
  track = 'var(--track)',
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
}) {
  const r = 60 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role={label ? 'img' : undefined} aria-label={label}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} style={{ fill: 'none', stroke: track, strokeWidth: stroke }} />
        {v > 0 && (
          <circle
            cx="60"
            cy="60"
            r={r}
            transform="rotate(-90 60 60)"
            style={{
              fill: 'none',
              stroke: color,
              strokeWidth: stroke,
              strokeLinecap: 'round',
              strokeDasharray: `${c * v} ${c}`,
              transition: 'stroke-dasharray 500ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

export function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="col" style={{ gap: 5 }}>
      <div className="row between small">
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span className="muted">
          {Math.round(value)} / {Math.round(target)} g
        </span>
      </div>
      <div className="bar">
        <div style={{ width: pct + '%', background: color }} />
      </div>
    </div>
  );
}

// ---------- Feuille du bas, à ressort, qu'on peut tirer pour fermer ----------
function project(v: number, d = 0.998) {
  return ((v / 1000) * d) / (1 - d);
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  full,
  right,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  full?: boolean;
  right?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={'sheet' + (full ? ' full' : '')}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.42 }}
            drag={reduce ? false : 'y'}
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 1 }}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            onDragEnd={(_, info) => {
              if (info.offset.y + project(info.velocity.y) > 180) onClose();
            }}
          >
            <div className="sheet-grip" onPointerDown={(e) => controls.start(e)} style={{ touchAction: 'none' }}>
              <span />
            </div>
            <div className="sheet-head" onPointerDown={(e) => controls.start(e)} style={{ touchAction: 'none' }}>
              <h2 className="h2" style={{ fontSize: 19 }}>
                {title}
              </h2>
              <div className="row" style={{ gap: 6 }}>
                {right}
                <button className="icon-btn plain press" onClick={onClose} aria-label="Fermer" onPointerDown={(e) => e.stopPropagation()}>
                  <Icon name="x" />
                </button>
              </div>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------- Petits messages en bas de l'écran ----------
type ToastState = { text: string; action?: { label: string; run: () => void } } | null;
let toast: ToastState = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastListeners = new Set<() => void>();

export function showToast(text: string, action?: { label: string; run: () => void }, ms = 3200) {
  toast = { text, action };
  toastListeners.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast = null;
    toastListeners.forEach((l) => l());
  }, ms);
}

export function Toasts() {
  const t = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toast
  );
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {t && (
        <motion.div
          key={t.text}
          className="toast"
          role="status"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, x: '-50%' }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, x: '-50%' }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, x: '-50%' }}
          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          style={{ x: '-50%' }}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run();
                toast = null;
                toastListeners.forEach((l) => l());
              }}
            >
              {t.action.label}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  unit,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  unit?: string;
  format?: (v: number) => string;
}) {
  const fix = (v: number) => Math.max(min, Math.round(v * 100) / 100);
  return (
    <div className="stepper">
      <button className="press" aria-label={`Moins ${step}`} onClick={() => onChange(fix(value - step))}>
        <Icon name="minus" size={24} />
      </button>
      <output aria-live="polite">
        {format ? format(value) : value}
        {unit && <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink2)', marginLeft: 4 }}>{unit}</span>}
      </output>
      <button className="press" aria-label={`Plus ${step}`} onClick={() => onChange(fix(value + step))}>
        <Icon name="plus" size={24} />
      </button>
    </div>
  );
}

// ---------- Glisser vers la gauche pour supprimer (comme sur iPhone) ----------
const ACTION = 92;
let closeOpenRow: (() => void) | null = null;

export function SwipeRow({ children, onDelete, label = 'Supprimer' }: { children: ReactNode; onDelete: () => void; label?: string }) {
  const x = useMotionValue(0);
  const ref = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const armed = useRef(false);
  const reduce = useReducedMotion();
  const actionOpacity = useTransform(x, [-ACTION * 0.6, -12, 0], [1, 0.4, 0]);
  const [full, setFull] = useState(false);
  const spring = (to: number, velocity = 0) => animate(x, to, reduce ? { duration: 0.15 } : { type: 'spring', bounce: 0, duration: 0.35, velocity });

  function close() {
    spring(0);
  }

  // un retour haptique quand on passe le seuil de suppression complète
  useMotionValueEvent(x, 'change', (v) => {
    const w = ref.current?.offsetWidth ?? 360;
    const past = v < -w * 0.55;
    if (past !== armed.current) {
      armed.current = past;
      setFull(past);
      if (past) haptic();
    }
  });

  async function remove() {
    const w = ref.current?.offsetWidth ?? 360;
    await spring(-w - 40);
    onDelete();
    x.set(0);
  }

  return (
    <div ref={ref} className="swipe-row">
      <motion.button className="swipe-action" style={{ opacity: actionOpacity }} onClick={remove} aria-label={label} tabIndex={-1}>
        <Icon name="trash" size={20} />
        <span>{full ? 'Lâche' : label}</span>
      </motion.button>
      <motion.div
        className="swipe-front"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -Infinity, right: 0 }}
        dragElastic={{ left: 0, right: 0.15 }}
        dragMomentum={false}
        onDragStart={() => {
          dragged.current = true;
          if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
        }}
        onDragEnd={(_, info) => {
          const w = ref.current?.offsetWidth ?? 360;
          const end = x.get() + project(info.velocity.x);
          // suppression directe seulement si on a vraiment tiré loin (pas sur un simple coup de doigt)
          if (x.get() < -w * 0.55) void remove();
          else if (end < -ACTION / 2) {
            spring(-ACTION, info.velocity.x);
            closeOpenRow = close;
          } else spring(0, info.velocity.x);
          setTimeout(() => (dragged.current = false), 80);
        }}
        onClickCapture={(e) => {
          // le clic qui suit un glissé est ignoré ; un tap sur une ligne ouverte la referme
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
          } else if (x.get() < -4) {
            e.stopPropagation();
            e.preventDefault();
            close();
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
