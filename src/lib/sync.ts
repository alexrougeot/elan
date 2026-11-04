// Synchronisation avec Supabase : on envoie ce qui a changé sur le téléphone,
// puis on récupère ce qui a changé ailleurs. Le plus récent gagne.
import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { dirtyDocs, getMeta, markClean, mergeRemote, setMeta, setWriteHook, type Doc } from './store';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline' | 'error';

let status: SyncStatus = navigator.onLine ? 'idle' : 'offline';
let lastOk: string | null = null;
let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((l) => l());
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status
  );
}

export function lastSyncAt() {
  return lastOk;
}

export function scheduleSync(delay = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow() {
  if (!supabase) return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    setStatus('syncing');

    // 1. Envoyer les changements locaux
    const dirty = dirtyDocs();
    for (let i = 0; i < dirty.length; i += 200) {
      const chunk = dirty.slice(i, i + 200);
      const rows = chunk.map((d) => ({
        id: d.id,
        kind: d.kind,
        data: d.data,
        updated_at: d.updated_at,
        deleted: !!d.deleted,
      }));
      const { error } = await supabase.from('docs').upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
      await markClean(chunk);
    }

    // 2. Récupérer les changements faits ailleurs
    let since = (await getMeta<string>('lastPull')) || '1970-01-01T00:00:00Z';
    for (;;) {
      const { data: rows, error } = await supabase
        .from('docs')
        .select('id,kind,data,updated_at,deleted,server_updated_at')
        .gt('server_updated_at', since)
        .order('server_updated_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      if (!rows || rows.length === 0) break;
      await mergeRemote(rows as unknown as Doc[]);
      since = (rows[rows.length - 1] as { server_updated_at: string }).server_updated_at;
      await setMeta('lastPull', since);
      if (rows.length < 500) break;
    }
    lastOk = new Date().toISOString();
    setStatus('ok');
  } catch (e) {
    console.warn('Synchronisation impossible', e);
    setStatus(navigator.onLine ? 'error' : 'offline');
  } finally {
    running = false;
    if (again) {
      again = false;
      scheduleSync(500);
    }
  }
}

let started = false;
export function startSyncLoop() {
  setWriteHook(() => scheduleSync());
  if (started) return;
  started = true;
  window.addEventListener('online', () => scheduleSync(200));
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(300);
  });
  setInterval(() => scheduleSync(0), 60_000);
}
