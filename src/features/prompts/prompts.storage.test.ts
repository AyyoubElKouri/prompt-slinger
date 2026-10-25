import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PromptSnapshot } from '../../shared/types/prompt';
import {
  SNAPSHOT_KEY,
  loadLibraryHandle,
  loadSnapshot,
  saveLibraryHandle,
  saveSnapshot,
  type SnapshotStorage,
} from './prompts.storage';

const snapshot: PromptSnapshot = {
  version: 1,
  folderName: 'Prompt Shelf',
  scannedAt: 1_700_000_000_000,
  prompts: [
    {
      id: 'code-review.md',
      name: 'Code review',
      iconName: 'code-xml',
      body: 'Review this',
      fileName: 'code-review.md',
      relativePath: 'code-review.md',
    },
  ],
};

function memoryStorage(): SnapshotStorage & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    async get(key) {
      return { [key]: data[key] };
    },
    async set(items) {
      Object.assign(data, items);
    },
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory() as unknown as IDBFactory;
});

describe('snapshot storage', () => {
  it('round-trips a snapshot', async () => {
    const storage = memoryStorage();
    await saveSnapshot(snapshot, storage);
    expect(storage.data[SNAPSHOT_KEY]).toEqual(snapshot);
    expect(await loadSnapshot(storage)).toEqual(snapshot);
  });

  it('rejects a corrupted snapshot', async () => {
    const storage = memoryStorage();
    storage.data[SNAPSHOT_KEY] = { version: 9, prompts: 'nope' };
    expect(await loadSnapshot(storage)).toBeNull();
  });

  it('returns null when nothing is stored', async () => {
    expect(await loadSnapshot(memoryStorage())).toBeNull();
  });
});

describe('library handle storage', () => {
  it('round-trips a directory handle', async () => {
    const handle = { kind: 'directory', name: 'Prompt Shelf' } as unknown as FileSystemDirectoryHandle;
    await saveLibraryHandle(handle);
    expect(await loadLibraryHandle()).toMatchObject({ kind: 'directory', name: 'Prompt Shelf' });
  });

  it('returns null when no handle is stored', async () => {
    expect(await loadLibraryHandle()).toBeNull();
  });
});
