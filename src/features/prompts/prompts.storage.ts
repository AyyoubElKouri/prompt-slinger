import { browser } from 'wxt/browser';
import type { PromptSnapshot } from '../../shared/types/prompt';

export const SNAPSHOT_KEY = 'promptSlinger.snapshot.v1';
const DB_NAME = 'prompt-slinger';
const DB_VERSION = 1;
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'library';

export type SnapshotStorage = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

export function isPromptSnapshot(value: unknown): value is PromptSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PromptSnapshot>;
  return (
    candidate.version === 1 &&
    typeof candidate.folderName === 'string' &&
    typeof candidate.scannedAt === 'number' &&
    Array.isArray(candidate.prompts)
  );
}

export async function loadSnapshot(
  storage: SnapshotStorage = browser.storage.local,
): Promise<PromptSnapshot | null> {
  const result = await storage.get(SNAPSHOT_KEY);
  const value = result[SNAPSHOT_KEY];
  return isPromptSnapshot(value) ? value : null;
}

export async function saveSnapshot(
  snapshot: PromptSnapshot,
  storage: SnapshotStorage = browser.storage.local,
): Promise<void> {
  await storage.set({ [SNAPSHOT_KEY]: snapshot });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLibraryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE, 'readwrite');
      transaction.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function loadLibraryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDatabase();
  try {
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE, 'readonly');
      const request = transaction.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      request.onsuccess = () =>
        resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
