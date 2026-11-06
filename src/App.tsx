import { useEffect, useState } from 'react';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { getData, openStore, putDoc, useStoreVersion } from './lib/store';
import { loadCustomExercises, upgradedProgram, womenSwap, type Program } from './lib/program';
import { startSyncLoop, syncNow } from './lib/sync';
import type { Profile } from './lib/nutrition';
import { Icon, LogoMark, Toasts, showToast } from './components/ui';
import { RunHost } from './screens/Runs';
import AuthScreen from './screens/Auth';
import Onboarding from './screens/Onboarding';
import Today from './screens/Today';
import Workout from './screens/Workout';
import Nutrition from './screens/Nutrition';
import Progress from './screens/Progress';
import Settings, { type SettingsStart } from './screens/Settings';

export type Tab = 'today' | 'workout' | 'nutrition' | 'progress';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: 'home' },
  { id: 'workout', label: 'Séance', icon: 'dumbbell' },
  { id: 'nutrition', label: 'Nutrition', icon: 'fork' },
  { id: 'progress', label: 'Progrès', icon: 'chart' },
];

function storedUserId(): string | null {
  try {
    const raw = localStorage.getItem('elan-auth');
    if (raw) return JSON.parse(raw)?.user?.id ?? null;
  } catch {
    /* rien */
  }
  return localStorage.getItem('elan.uid');
}

function initialTab(): Tab {
  const q = new URLSearchParams(location.search).get('onglet');
  const map: Record<string, Tab> = { seance: 'workout', nutrition: 'nutrition', progres: 'progress' };
  return (q && map[q]) || (sessionStorage.getItem('elan.tab') as Tab) || 'today';
}

export default function App() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Mode démo, uniquement en développement, pour tester l'interface sans compte
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
      setUid('demo');
      return;
    }
    if (!supabase) {
      setUid(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUid(data.session.user.id);
      else if (!navigator.onLine && storedUserId()) setUid(storedUserId());
      else setUid(null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s: AuthSession | null) => {
      if (s) {
        localStorage.setItem('elan.uid', s.user.id);
        setUid(s.user.id);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('elan.uid');
        setUid(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) {
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await openStore(uid);
      if (cancelled) return;
      startSyncLoop();
      setReady(true);
      void syncNow();
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (uid === undefined || (uid && !ready)) return <Splash />;
  if (!uid) return <AuthScreen />;
  return <Signed />;
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LogoMark size={72} />
    </div>
  );
}

function Signed() {
  useStoreVersion();
  loadCustomExercises();
  const profile = getData<Profile>('profile');
  const [firstSyncDone, setFirstSyncDone] = useState(!!profile);

  useEffect(() => {
    if (profile) return;
    // Un compte existant : on attend la première synchronisation avant de proposer l'accueil
    let alive = true;
    syncNow().finally(() => alive && setFirstSyncDone(true));
    const t = setTimeout(() => alive && setFirstSyncDone(true), 4000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [profile]);

  if (!profile) return firstSyncDone ? <Onboarding /> : <Splash />;
  return <Shell />;
}

function Shell() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [settings, setSettings] = useState(false);
  const [settingsStart, setSettingsStart] = useState<SettingsStart>(null);

  // Programme type d'origine jamais modifié : on passe à la nouvelle version
  useEffect(() => {
    const prog = getData<Program>('program');
    const sex = getData<{ sex?: string }>('profile')?.sex;
    const women = prog ? womenSwap(prog, sex) : null;
    if (prog && women) {
      void putDoc('program', 'program', women);
      // séances décalées : on garde le décalage, avec la séance qui tombe le même jour dans le nouveau programme
      const moves = getData<Record<string, string | null>>('moves');
      if (moves) {
        const map: Record<string, string> = {};
        for (const d of prog.days) {
          const n = women.days.find((x) => x.weekday === d.weekday);
          if (n) map[d.id] = n.id;
        }
        const next = Object.fromEntries(Object.entries(moves).map(([k, v]) => [k, v && map[v] ? map[v] : v]));
        if (JSON.stringify(next) !== JSON.stringify(moves)) void putDoc('moves', 'moves', next);
      }
      showToast('Nouveau programme rien que pour toi : fessiers et jambes, haut du corps tonique, gainage à chaque séance', undefined, 7000);
      return;
    }
    const next = prog ? upgradedProgram(prog) : null;
    if (next) {
      void putDoc('program', 'program', next);
      showToast('Programme mis à jour : latérales et face pull en plus, abdos à chaque séance', undefined, 6000);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('elan.tab', tab);
    if (location.search) history.replaceState(null, '', location.pathname);
    window.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="app">
      {tab === 'today' && (
        <Today
          go={setTab}
          openSettings={() => {
            setSettingsStart(null);
            setSettings(true);
          }}
        />
      )}
      {tab === 'workout' && (
        <Workout
          go={setTab}
          openProgram={(dayId) => {
            setSettingsStart({ page: 'program', dayId });
            setSettings(true);
          }}
        />
      )}
      {tab === 'nutrition' && <Nutrition />}
      {tab === 'progress' && <Progress />}

      <nav className="tabbar" aria-label="Navigation">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} className="tab press" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <span className="tab-ico">
                <Icon name={t.icon} size={24} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <Settings open={settings} onClose={() => setSettings(false)} start={settingsStart} />
      <RunHost />
      <Toasts />
    </div>
  );
}
