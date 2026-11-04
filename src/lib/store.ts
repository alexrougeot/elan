// Stockage local d'abord : tout est enregistré sur le téléphone (IndexedDB),
// puis synchronisé avec Supabase dès que le réseau est là.
import { openDB, type IDBPDatabase } from 'idb';
import { useSyncExternalStore } from 'react';

export type Doc<T = any> = {
  id: string;
  kind: string;
  data: T;
  updated_at: string;
  deleted?: boolean;
  dirty?: 0 | 1;
};

let db: IDBPDatabase | null = null;
const docs = new Map<string, Doc>();
const listeners = new Set<() => void>();
let version = 0;
let onWrite: (() => void) | null = null;

export function setWriteHook(fn: () => void) {
  onWrite = fn;
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useStoreVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

export async function openStore(uid: string) {
  db?.close();
  db = await openDB('elan-' + uid, 1, {
    upgrade(d) {
      d.createObjectStore('docs', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  docs.clear();
  for (const d of (await db.getAll('docs')) as Doc[]) docs.set(d.id, d);
  emit();
}

export function closeStore() {
  db?.close();
  db = null;
  docs.clear();
  emit();
}

export function getDoc<T = any>(id: string): Doc<T> | undefined {
  const d = docs.get(id);
  return d && !d.deleted ? (d as Doc<T>) : undefined;
}

export function getData<T = any>(id: string): T | undefined {
  return getDoc<T>(id)?.data;
}

export function allOf<T = any>(kind: string): Doc<T>[] {
  const out: Doc<T>[] = [];
  for (const d of docs.values()) if (d.kind === kind && !d.deleted) out.push(d as Doc<T>);
  return out;
}

export async function putDoc<T>(id: string, kind: string, data: T) {
  const d: Doc<T> = { id, kind, data, updated_at: new Date().toISOString(), dirty: 1 };
  docs.set(id, d);
  emit();
  await db?.put('docs', d);
  onWrite?.();
  return d;
}

export async function removeDoc(id: string) {
  const prev = docs.get(id);
  if (!prev) return;
  const d: Doc = { ...prev, deleted: true, updated_at: new Date().toISOString(), dirty: 1 };
  docs.set(id, d);
  emit();
  await db?.put('docs', d);
  onWrite?.();
}

export function dirtyDocs(): Doc[] {
  return [...docs.values()].filter((d) => d.dirty);
}

export async function markClean(sent: Doc[]) {
  if (!db) return;
  const tx = db.transaction('docs', 'readwrite');
  for (const s of sent) {
    const cur = docs.get(s.id);
    if (cur && cur.updated_at === s.updated_at) {
      const clean = { ...cur, dirty: 0 as const };
      docs.set(s.id, clean);
      await tx.store.put(clean);
    }
  }
  await tx.done;
}

export async function mergeRemote(rows: Doc[]) {
  if (!db || rows.length === 0) return;
  let changed = false;
  const tx = db.transaction('docs', 'readwrite');
  for (const r of rows) {
    const cur = docs.get(r.id);
    if (cur && cur.updated_at >= r.updated_at) continue;
    const d: Doc = { id: r.id, kind: r.kind, data: r.data, updated_at: r.updated_at, deleted: r.deleted, dirty: 0 };
    docs.set(r.id, d);
    await tx.store.put(d);
    changed = true;
  }
  await tx.done;
  if (changed) emit();
}

export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  return db ? ((await db.get('meta', key)) as T) : undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db?.put('meta', value, key);
}

export function uid() {
  return crypto.randomUUID();
}
