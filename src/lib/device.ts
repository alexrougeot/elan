// Retours physiques : vibration, son, écran allumé.

let hapticLabel: HTMLLabelElement | null = null;

/** Petite vibration. Sur iPhone, Safari ne vibre que pendant un geste de l'utilisateur. */
export function haptic() {
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
      return;
    }
    if (!hapticLabel) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'elan-haptic';
      input.setAttribute('aria-hidden', 'true');
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-10px';
      hapticLabel = document.createElement('label');
      hapticLabel.htmlFor = 'elan-haptic';
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;left:-10px';
      document.body.append(input, hapticLabel);
    }
    hapticLabel.click();
  } catch {
    /* rien */
  }
}

let ctx: AudioContext | null = null;

/** À appeler pendant un geste : iOS n'autorise le son qu'après une interaction. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* rien */
  }
}

/** Trois bips courts pour la fin du repos */
export function beep() {
  try {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((dt, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1046 : 880;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.16);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.18);
    });
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') navigator.vibrate([120, 80, 120]);
  } catch {
    /* rien */
  }
}

let lock: any = null;
let wantLock = false;

export async function keepScreenOn(on: boolean) {
  wantLock = on;
  try {
    if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await (navigator as any).wakeLock.request('screen');
      lock.addEventListener?.('release', () => {
        lock = null;
      });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantLock) void keepScreenOn(true);
});

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Réduit une photo pour la stocker (JPEG ~ 900 px) */
export async function compressImage(file: File, max = 900, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
