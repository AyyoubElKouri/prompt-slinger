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

export type PickedFolder = {
  folderName: string;
  files: File[];
};

export function supportsDirectoryPicker(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

export function chooseLibraryFiles(): Promise<PickedFolder | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.md,text/markdown';
    input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';

    let settled = false;
    const finish = (value: PickedFolder | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener(
      'change',
      () => {
        const all = Array.from(input.files ?? []);
        const folderName = all[0]?.webkitRelativePath.split('/')[0] || 'Prompts';
        const files = all.filter((file) => file.name.toLowerCase().endsWith('.md'));
        finish({ folderName, files });
      },
      { once: true },
    );
    input.addEventListener('cancel', () => finish(null), { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

export async function buildSnapshotFromFiles(
  picked: PickedFolder,
): Promise<{ snapshot: PromptSnapshot; capped: boolean }> {
  const prompts: Prompt[] = [];
  let capped = false;

  for (const file of picked.files) {
    if (!file.name.toLowerCase().endsWith('.md')) continue;

    if (prompts.length >= MAX_PROMPTS) {
      capped = true;
      break;
    }

    const parts = file.webkitRelativePath.split('/');
    const relativeParts = parts.slice(1);

    if (relativeParts.some((part) => part.startsWith('.'))) continue;
    if (relativeParts.length > MAX_DEPTH) {
      capped = true;
      continue;
    }

    try {
      const text = await file.text();
      prompts.push(parsePrompt(text, file.name, relativeParts.join('/') || file.name));
    } catch {
      // Unreadable files are skipped; the rest of the folder still loads.
    }
  }

  return {
    snapshot: {
      version: 1,
      folderName: picked.folderName,
      scannedAt: Date.now(),
      prompts,
    },
    capped,
  };
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
