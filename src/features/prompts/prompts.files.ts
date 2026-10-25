import type { Prompt, PromptSnapshot, ScanResult } from '../../shared/types/prompt';
import { parsePrompt } from './prompts.parse';

export const MAX_PROMPTS = 2000;
export const MAX_DEPTH = 16;

type PermissionCapableHandle = FileSystemDirectoryHandle & {
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
};

type IterableDirectory = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>;
};

async function* childrenOf(directory: FileSystemDirectoryHandle): AsyncGenerator<FileSystemHandle> {
  yield* (directory as IterableDirectory).values();
}

export async function scanDirectory(root: FileSystemDirectoryHandle): Promise<ScanResult> {
  const prompts: Prompt[] = [];
  let capped = false;

  async function walk(directory: FileSystemDirectoryHandle, prefix: string, depth: number) {
    if (capped) return;

    for await (const handle of childrenOf(directory)) {
      if (handle.name.startsWith('.')) continue;

      const relativePath = prefix ? `${prefix}/${handle.name}` : handle.name;

      if (handle.kind === 'directory') {
        if (depth >= MAX_DEPTH) {
          capped = true;
          return;
        }
        await walk(handle as FileSystemDirectoryHandle, relativePath, depth + 1);
        continue;
      }

      if (!handle.name.toLowerCase().endsWith('.md')) continue;

      if (prompts.length >= MAX_PROMPTS) {
        capped = true;
        return;
      }

      try {
        const text = await (handle as FileSystemFileHandle).getFile().then((file) => file.text());
        prompts.push(parsePrompt(text, handle.name, relativePath));
      } catch {
        // Unreadable files are skipped; the rest of the folder still loads.
      }
    }
  }

  await walk(root, '', 0);
  return { prompts, capped };
}

export async function chooseLibraryFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker({ mode: 'read' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const permissionHandle = handle as PermissionCapableHandle;
  if (!permissionHandle.queryPermission || !permissionHandle.requestPermission) return true;
  if ((await permissionHandle.queryPermission({ mode: 'read' })) === 'granted') return true;
  return (await permissionHandle.requestPermission({ mode: 'read' })) === 'granted';
}

export async function buildSnapshot(
  handle: FileSystemDirectoryHandle,
): Promise<{ snapshot: PromptSnapshot; capped: boolean }> {
  const { prompts, capped } = await scanDirectory(handle);
  return {
    snapshot: {
      version: 1,
      folderName: handle.name,
      scannedAt: Date.now(),
      prompts,
    },
    capped,
  };
}
