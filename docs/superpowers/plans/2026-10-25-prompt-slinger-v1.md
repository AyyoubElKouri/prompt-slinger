# Prompt Slinger v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Prompt Slinger popup that reads Markdown prompts from a user-picked folder, renders them with Lucide icons in a pixel-faithful popup, and injects the chosen prompt into any AI chat composer.

**Architecture:** A React popup reads a browser-stored prompt snapshot and talks to a persistent content script. The content script tracks the last focused editable element, appends the prompt body plus a `---` separator, flashes the input, and acknowledges so the popup can close. Folder access uses the File System Access API; the directory handle lives in IndexedDB and the parsed prompt snapshot lives in `chrome.storage.local`.

**Tech Stack:** WXT 0.21, React 19, TypeScript 5.9, Tailwind 4 (existing), `lucide-react`, `yaml`, Vitest, jsdom, fake-indexeddb, Bun.

**Spec:** `docs/superpowers/specs/2026-10-25-prompt-slinger-v1-design.md`

## Global Constraints

- The visual source of truth is `public/design/Popup.html`. Match its layout, spacing, colors, typography, hover/focus states, and scrollbar exactly. Any visual difference is a bug.
- Popup window is exactly `404px × 584px`; outer background `#1D1F18`; card background `#262922`; card border `1px solid #3A3E2F`; radius `6px`.
- Font is the Gelica OTF embedded in `Popup.html`, copied to `public/fonts/gelica.otf`, fallback `Georgia, serif`.
- The only permitted UI addition is the one-line status area under the header. It appears only when a failure must not replace the prompt list.
- Exactly one user-picked folder. Recursive `.md` scan, flat list.
- Frontmatter fields are only `name` and `icon-name` (kebab-case Lucide name).
- Injected text is exactly `existing + optional leading "\n" + body + "\n---\n"`. Frontmatter is never injected.
- Popup closes only after a successful injection acknowledgement.
- No network calls, analytics, telemetry, remote code, or writes to the picked folder.
- Chromium Manifest V3 only. Use Bun for install, scripts, and builds.
- Entrypoints stay thin; feature logic lives in `src/features/prompts/` per `AGENTS.md`.
- This directory is currently not a git repository. Run `git init` once before Task 1 so the commit steps work.

## Review Focus

- **Permission loss or a deleted folder:** reload must keep the stale prompt list visible and show `Folder unavailable — choose it again.` instead of blanking the UI. Pinned in Task 5 and Task 9.
- **Malformed or missing frontmatter:** a bad YAML file must never break the folder scan; it falls back to filename, `file-text`, and the whole file as body. Pinned in Task 1.
- **Rich-text editors with no `execCommand`:** contenteditable insertion must fall back to a text node and dispatch `input`, or report failure. Pinned in Task 6.
- **Existing input text, empty input, and trailing newlines:** the inserted text must not lose data or add a stray leading newline. Pinned in Task 6.
- **No editable target** (unsupported page or no composer): the content script replies with an error and the popup stays open instead of closing silently. Pinned in Task 6.
- **Large folders:** scan caps at 2,000 prompts and depth 16 and reports the cap instead of hanging. Pinned in Task 5.

---

### Task 1: Prompt types, frontmatter parsing, and the test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/shared/types/prompt.ts`
- Create: `src/features/prompts/prompts.parse.ts`
- Test: `src/features/prompts/prompts.parse.test.ts`

**Interfaces:**
- Produces:
  - `type Prompt` with `{ id, name, iconName, body, fileName, relativePath }`
  - `type PromptSnapshot` with `{ version: 1, folderName, scannedAt, prompts }`
  - `type ScanResult` with `{ prompts: Prompt[], capped: boolean }`
  - `parsePrompt(raw: string, fileName: string, relativePath: string): Prompt`

- [ ] **Step 1: Install test and parsing dependencies**

Run:
```bash
bun add yaml
bun add -d vitest jsdom fake-indexeddb
```

- [ ] **Step 2: Add the test script**

Add `"test": "vitest run"` to the `scripts` block in `package.json`, after `"compile"`.

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'node',
    restoreMocks: true,
  },
});
```

- [ ] **Step 4: Write the failing parsing tests**

Create `src/features/prompts/prompts.parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePrompt } from './prompts.parse';

describe('parsePrompt', () => {
  it('parses frontmatter name and icon-name and trims the body', () => {
    const raw = '---\nname: "Code Review"\nicon-name: code-xml\n---\n\nReview this.\n';
    expect(parsePrompt(raw, 'code-review.md', 'Writing/code-review.md')).toEqual({
      id: 'Writing/code-review.md',
      name: 'Code Review',
      iconName: 'code-xml',
      body: 'Review this.',
      fileName: 'code-review.md',
      relativePath: 'Writing/code-review.md',
    });
  });

  it('falls back to the filename and file-text when fields are missing', () => {
    const raw = '---\ndescription: nope\n---\nBody';
    const prompt = parsePrompt(raw, 'fallback.md', 'fallback.md');
    expect(prompt.name).toBe('fallback');
    expect(prompt.iconName).toBe('file-text');
    expect(prompt.body).toBe('Body');
  });

  it('treats malformed YAML as no frontmatter', () => {
    const raw = '---\nname: [unclosed\n---\nBody';
    const prompt = parsePrompt(raw, 'broken.md', 'broken.md');
    expect(prompt.name).toBe('broken');
    expect(prompt.iconName).toBe('file-text');
    expect(prompt.body).toBe(raw);
  });

  it('handles CRLF and a BOM', () => {
    const raw = '\uFEFF---\r\nname: Test\r\nicon-name: sparkles\r\n---\r\nHello';
    expect(parsePrompt(raw, 'test.md', 'test.md')).toMatchObject({
      name: 'Test',
      iconName: 'sparkles',
      body: 'Hello',
    });
  });

  it('uses the whole file when there is no frontmatter', () => {
    const raw = 'Just a prompt\nwith lines';
    expect(parsePrompt(raw, 'plain.md', 'plain.md')).toMatchObject({
      name: 'plain',
      iconName: 'file-text',
      body: raw,
    });
  });
});
```

- [ ] **Step 5: Run the tests and confirm they fail**

Run:
```bash
bun run test -- src/features/prompts/prompts.parse.test.ts
```
Expected: FAIL because `./prompts.parse` does not exist.

- [ ] **Step 6: Create the shared prompt types**

Create `src/shared/types/prompt.ts`:

```ts
export type Prompt = {
  id: string;
  name: string;
  iconName: string;
  body: string;
  fileName: string;
  relativePath: string;
};

export type PromptSnapshot = {
  version: 1;
  folderName: string;
  scannedAt: number;
  prompts: Prompt[];
};

export type ScanResult = {
  prompts: Prompt[];
  capped: boolean;
};
```

- [ ] **Step 7: Implement the parser**

Create `src/features/prompts/prompts.parse.ts`:

```ts
import { parse as parseYaml } from 'yaml';
import type { Prompt } from '../../shared/types/prompt';

const FRONTMATTER = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parsePrompt(raw: string, fileName: string, relativePath: string): Prompt {
  let data: Record<string, unknown> | null = null;
  let body = raw;
  const match = FRONTMATTER.exec(raw);

  if (match) {
    try {
      const parsed = parseYaml(match[1]) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
        body = raw.slice(match[0].length);
      }
    } catch {
      data = null;
    }
  }

  const rawName = data?.name;
  const rawIcon = data?.['icon-name'];
  const fallbackName = fileName.replace(/\.md$/i, '');
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : fallbackName;
  const iconName = typeof rawIcon === 'string' && rawIcon.trim() ? rawIcon.trim() : 'file-text';

  return {
    id: relativePath,
    name,
    iconName,
    body: body.trim(),
    fileName,
    relativePath,
  };
}
```

- [ ] **Step 8: Run the tests and confirm they pass**

Run:
```bash
bun run test -- src/features/prompts/prompts.parse.test.ts
```
Expected: PASS, 5 tests.

- [ ] **Step 9: Commit**

```bash
git add package.json bun.lock vitest.config.ts src/shared/types/prompt.ts src/features/prompts/prompts.parse.ts src/features/prompts/prompts.parse.test.ts
git commit -m "feat: parse prompt markdown frontmatter"
```

---

### Task 2: Search filtering and sorting

**Files:**
- Create: `src/features/prompts/prompts.filter.ts`
- Test: `src/features/prompts/prompts.filter.test.ts`

**Interfaces:**
- Consumes: `Prompt` from Task 1.
- Produces:
  - `filterPrompts(prompts: Prompt[], query: string): Prompt[]`
  - `sortPrompts(prompts: Prompt[]): Prompt[]`

- [ ] **Step 1: Write the failing tests**

Create `src/features/prompts/prompts.filter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Prompt } from '../../shared/types/prompt';
import { filterPrompts, sortPrompts } from './prompts.filter';

function prompt(name: string, fileName: string): Prompt {
  return {
    id: fileName,
    name,
    iconName: 'file-text',
    body: 'body',
    fileName,
    relativePath: fileName,
  };
}

const prompts = [
  prompt('Weekly review', 'weekly-review.md'),
  prompt('Code review', 'code-review.md'),
  prompt('Translate', 'translate-tone.md'),
];

describe('filterPrompts', () => {
  it('returns everything for an empty query', () => {
    expect(filterPrompts(prompts, '   ')).toEqual(prompts);
  });

  it('matches the display name case-insensitively', () => {
    expect(filterPrompts(prompts, 'WEEKLY').map((p) => p.name)).toEqual(['Weekly review']);
  });

  it('matches the filename case-insensitively', () => {
    expect(filterPrompts(prompts, 'tone').map((p) => p.name)).toEqual(['Translate']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterPrompts(prompts, 'zzz')).toEqual([]);
  });
});

describe('sortPrompts', () => {
  it('sorts by name and does not mutate the input', () => {
    const input = [prompts[0], prompts[1]];
    expect(sortPrompts(input).map((p) => p.name)).toEqual(['Code review', 'Weekly review']);
    expect(input.map((p) => p.name)).toEqual(['Weekly review', 'Code review']);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:
```bash
bun run test -- src/features/prompts/prompts.filter.test.ts
```
Expected: FAIL because `./prompts.filter` does not exist.

- [ ] **Step 3: Implement filtering and sorting**

Create `src/features/prompts/prompts.filter.ts`:

```ts
import type { Prompt } from '../../shared/types/prompt';

export function filterPrompts(prompts: Prompt[], query: string): Prompt[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return prompts;
  return prompts.filter(
    (prompt) =>
      prompt.name.toLowerCase().includes(needle) ||
      prompt.fileName.toLowerCase().includes(needle),
  );
}

export function sortPrompts(prompts: Prompt[]): Prompt[] {
  return [...prompts].sort(
    (a, b) => a.name.localeCompare(b.name) || a.fileName.localeCompare(b.fileName),
  );
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run:
```bash
bun run test -- src/features/prompts/prompts.filter.test.ts
```
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/prompts/prompts.filter.ts src/features/prompts/prompts.filter.test.ts
git commit -m "feat: filter and sort prompts"
```

---

### Task 3: Lucide icon resolution

**Files:**
- Create: `src/features/prompts/prompts.icon.ts`
- Test: `src/features/prompts/prompts.icon.test.ts`

**Interfaces:**
- Produces: `resolveIcon(iconName: string): LucideIcon`

- [ ] **Step 1: Install Lucide**

Run:
```bash
bun add lucide-react
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/prompts/prompts.icon.test.ts`:

```ts
import { FileText, icons } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { resolveIcon } from './prompts.icon';

describe('resolveIcon', () => {
  it('resolves a kebab-case Lucide name', () => {
    expect(resolveIcon('code-xml')).toBe(icons.CodeXml);
  });

  it('resolves names containing digits', () => {
    expect(resolveIcon('rotate-3d')).toBe(icons.Rotate3D);
  });

  it('falls back to file-text for unknown names', () => {
    expect(resolveIcon('not-a-real-icon')).toBe(FileText);
  });

  it('falls back for an empty name', () => {
    expect(resolveIcon('')).toBe(FileText);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run:
```bash
bun run test -- src/features/prompts/prompts.icon.test.ts
```
Expected: FAIL because `./prompts.icon` does not exist.

- [ ] **Step 4: Implement icon resolution**

Create `src/features/prompts/prompts.icon.ts`:

```ts
import { FileText, icons, type LucideIcon } from 'lucide-react';

const byNormalizedName = new Map<string, LucideIcon>();

for (const [name, Icon] of Object.entries(icons)) {
  byNormalizedName.set(name.replace(/-/g, '').toLowerCase(), Icon as LucideIcon);
}

export function resolveIcon(iconName: string): LucideIcon {
  const normalized = iconName.replace(/-/g, '').toLowerCase();
  return byNormalizedName.get(normalized) ?? FileText;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run:
```bash
bun run test -- src/features/prompts/prompts.icon.test.ts
```
Expected: PASS, 4 tests. If `icons.Rotate3D` is undefined in the installed Lucide version, replace that assertion with `icons.RotateCw` and the kebab name `rotate-cw`; keep the digit-normalization code.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/features/prompts/prompts.icon.ts src/features/prompts/prompts.icon.test.ts
git commit -m "feat: resolve lucide icons from frontmatter"
```

---

### Task 4: Snapshot storage and the directory handle

**Files:**
- Create: `src/features/prompts/prompts.storage.ts`
- Create: `src/shared/types/file-system-access.d.ts`
- Test: `src/features/prompts/prompts.storage.test.ts`

**Interfaces:**
- Consumes: `PromptSnapshot` from Task 1.
- Produces:
  - `SNAPSHOT_KEY = 'promptSlinger.snapshot.v1'`
  - `type SnapshotStorage = { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> }`
  - `loadSnapshot(storage?: SnapshotStorage): Promise<PromptSnapshot | null>`
  - `saveSnapshot(snapshot: PromptSnapshot, storage?: SnapshotStorage): Promise<void>`
  - `saveLibraryHandle(handle: FileSystemDirectoryHandle): Promise<void>`
  - `loadLibraryHandle(): Promise<FileSystemDirectoryHandle | null>`

- [ ] **Step 1: Write the failing tests**

Create `src/features/prompts/prompts.storage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:
```bash
bun run test -- src/features/prompts/prompts.storage.test.ts
```
Expected: FAIL because `./prompts.storage` does not exist.

- [ ] **Step 3: Add the File System Access declaration**

Create `src/shared/types/file-system-access.d.ts`:

```ts
export {};

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite';
    }): Promise<FileSystemDirectoryHandle>;
  }
}
```

- [ ] **Step 4: Implement snapshot and handle storage**

Create `src/features/prompts/prompts.storage.ts`:

```ts
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
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run:
```bash
bun run test -- src/features/prompts/prompts.storage.test.ts
```
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/prompts/prompts.storage.ts src/features/prompts/prompts.storage.test.ts src/shared/types/file-system-access.d.ts
git commit -m "feat: persist prompt snapshot and folder handle"
```

---

### Task 5: Recursive folder scanning

**Files:**
- Create: `src/features/prompts/prompts.files.ts`
- Test: `src/features/prompts/prompts.files.test.ts`

**Interfaces:**
- Consumes: `parsePrompt` from Task 1; `Prompt`, `PromptSnapshot`, `ScanResult` from Task 1.
- Produces:
  - `MAX_PROMPTS = 2000`
  - `MAX_DEPTH = 16`
  - `scanDirectory(root: FileSystemDirectoryHandle): Promise<ScanResult>`
  - `chooseLibraryFolder(): Promise<FileSystemDirectoryHandle | null>`
  - `ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean>`
  - `buildSnapshot(handle: FileSystemDirectoryHandle): Promise<{ snapshot: PromptSnapshot; capped: boolean }>`

- [ ] **Step 1: Write the failing scan tests**

Create `src/features/prompts/prompts.files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_PROMPTS, ensureReadPermission, scanDirectory } from './prompts.files';

function file(name: string, text: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => new File([text], name, { type: 'text/markdown' }),
  } as unknown as FileSystemFileHandle;
}

function unreadableFile(name: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: async () => {
      throw new Error('nope');
    },
  } as unknown as FileSystemFileHandle;
}

function directory(name: string, children: FileSystemHandle[]): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    values: () =>
      (async function* () {
        for (const child of children) yield child;
      })(),
  } as unknown as FileSystemDirectoryHandle;
}

describe('scanDirectory', () => {
  it('scans nested folders and ignores hidden or non-markdown files', async () => {
    const root = directory('Prompt Shelf', [
      file('root.md', '---\nname: Root\nicon-name: file-text\n---\nRoot body'),
      file('notes.txt', 'ignore me'),
      file('.hidden.md', 'ignore me'),
      directory('Writing', [
        file('blog.md', '---\nname: Blog\nicon-name: pen-line\n---\nBlog body'),
      ]),
      directory('.private', [file('secret.md', 'ignore me')]),
    ]);

    const result = await scanDirectory(root);

    expect(result.capped).toBe(false);
    expect(result.prompts.map((p) => p.relativePath).sort()).toEqual([
      'Writing/blog.md',
      'root.md',
    ]);
    expect(result.prompts.find((p) => p.name === 'Blog')?.body).toBe('Blog body');
  });

  it('skips unreadable files without failing the scan', async () => {
    const root = directory('Prompt Shelf', [
      unreadableFile('bad.md'),
      file('good.md', 'Good body'),
    ]);
    const result = await scanDirectory(root);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.fileName).toBe('good.md');
  });

  it('falls back for malformed frontmatter instead of failing', async () => {
    const root = directory('Prompt Shelf', [file('broken.md', '---\nname: [bad\n---\nBody')]);
    const result = await scanDirectory(root);
    expect(result.prompts[0]).toMatchObject({
      name: 'broken',
      iconName: 'file-text',
    });
  });

  it('caps the number of prompts', async () => {
    const files = Array.from({ length: MAX_PROMPTS + 1 }, (_, index) =>
      file(`p${index}.md`, `Prompt ${index}`),
    );
    const result = await scanDirectory(directory('Big', files));
    expect(result.prompts).toHaveLength(MAX_PROMPTS);
    expect(result.capped).toBe(true);
  });

  it('rejects when the folder cannot be listed', async () => {
    const gone = {
      kind: 'directory',
      name: 'Gone',
      values: () => {
        throw new Error('gone');
      },
    } as unknown as FileSystemDirectoryHandle;
    await expect(scanDirectory(gone)).rejects.toThrow('gone');
  });
});

describe('ensureReadPermission', () => {
  it('returns false when the user denies permission', async () => {
    const handle = {
      kind: 'directory',
      name: 'Denied',
      queryPermission: async () => 'prompt',
      requestPermission: async () => 'denied',
    } as unknown as FileSystemDirectoryHandle;
    expect(await ensureReadPermission(handle)).toBe(false);
  });

  it('returns true when permission is already granted', async () => {
    const handle = {
      kind: 'directory',
      name: 'Granted',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    } as unknown as FileSystemDirectoryHandle;
    expect(await ensureReadPermission(handle)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:
```bash
bun run test -- src/features/prompts/prompts.files.test.ts
```
Expected: FAIL because `./prompts.files` does not exist.

- [ ] **Step 3: Implement scanning and folder helpers**

Create `src/features/prompts/prompts.files.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run:
```bash
bun run test -- src/features/prompts/prompts.files.test.ts
```
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/prompts/prompts.files.ts src/features/prompts/prompts.files.test.ts
git commit -m "feat: scan prompt folders recursively"
```

---

### Task 6: Injection core and content-script message handling

**Files:**
- Create: `src/shared/types/injection.ts`
- Create: `src/features/prompts/prompts.content.ts`
- Test: `src/features/prompts/prompts.content.test.ts`

**Interfaces:**
- Produces:
  - `INJECT_MESSAGE = 'INJECT_PROMPT'`
  - `type InjectRequest = { type: typeof INJECT_MESSAGE; text: string }`
  - `type InjectResponse = { ok: true } | { ok: false; error: string }`
  - `buildInsertion(currentText: string, body: string): string`
  - `composeInjection(currentText: string, body: string): string`
  - `isEditableElement(element: Element | null): element is HTMLElement`
  - `findTarget(doc: Document, lastFocused: HTMLElement | null): HTMLElement | null`
  - `insertIntoField(target: HTMLElement, body: string): boolean`
  - `flashElement(target: HTMLElement): void`
  - `handleInjectRequest(doc: Document, lastFocused: HTMLElement | null, body: string): InjectResponse`
  - `startInjectionContentScript(): void`

- [ ] **Step 1: Define the injection message types**

Create `src/shared/types/injection.ts`:

```ts
export const INJECT_MESSAGE = 'INJECT_PROMPT' as const;

export type InjectRequest = {
  type: typeof INJECT_MESSAGE;
  text: string;
};

export type InjectResponse = { ok: true } | { ok: false; error: string };
```

- [ ] **Step 2: Write the failing injection tests**

Create `src/features/prompts/prompts.content.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildInsertion,
  composeInjection,
  handleInjectRequest,
  isEditableElement,
} from './prompts.content';

beforeEach(() => {
  document.body.innerHTML = '';
});

function visible<T extends HTMLElement>(element: T): T {
  element.getBoundingClientRect = () =>
    ({
      width: 300,
      height: 40,
      top: 700,
      left: 100,
      right: 400,
      bottom: 740,
      x: 100,
      y: 700,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(element);
  return element;
}

describe('text composition', () => {
  it('does not add a leading newline for an empty input', () => {
    expect(composeInjection('', 'Body')).toBe('Body\n---\n');
  });

  it('adds one leading newline for non-empty text', () => {
    expect(composeInjection('Existing', 'Body')).toBe('Existing\nBody\n---\n');
  });

  it('does not duplicate a trailing newline', () => {
    expect(composeInjection('Existing\n', 'Body')).toBe('Existing\nBody\n---\n');
  });

  it('keeps the exact separator', () => {
    expect(buildInsertion('', 'Body')).toBe('Body\n---\n');
  });
});

describe('isEditableElement', () => {
  it('accepts textareas and contenteditable elements', () => {
    expect(isEditableElement(visible(document.createElement('textarea')))).toBe(true);
    const rich = visible(document.createElement('div'));
    rich.setAttribute('contenteditable', 'true');
    expect(isEditableElement(rich)).toBe(true);
  });

  it('rejects checkboxes and null', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isEditableElement(checkbox)).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });
});

describe('handleInjectRequest', () => {
  it('reports an error when there is no editable target', () => {
    expect(handleInjectRequest(document, null, 'Body')).toEqual({
      ok: false,
      error: 'No editable input found on this page.',
    });
  });

  it('appends into a textarea', () => {
    const textarea = visible(document.createElement('textarea'));
    textarea.value = 'Existing';
    expect(handleInjectRequest(document, textarea, 'Body')).toEqual({ ok: true });
    expect(textarea.value).toBe('Existing\nBody\n---\n');
  });

  it('appends into a contenteditable element without execCommand support', () => {
    const rich = visible(document.createElement('div'));
    rich.setAttribute('contenteditable', 'true');
    rich.textContent = '';
    expect(handleInjectRequest(document, rich, 'Body')).toEqual({ ok: true });
    expect(rich.textContent).toBe('Body\n---\n');
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run:
```bash
bun run test -- src/features/prompts/prompts.content.test.ts
```
Expected: FAIL because `./prompts.content` does not exist.

- [ ] **Step 4: Implement the injection core**

Create `src/features/prompts/prompts.content.ts`:

```ts
import { browser } from 'wxt/browser';
import {
  INJECT_MESSAGE,
  type InjectResponse,
} from '../../shared/types/injection';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url']);
const EDITABLE_SELECTOR = 'textarea, input, [contenteditable="true"], [role="textbox"]';

export function buildInsertion(currentText: string, body: string): string {
  const leadingNewline = currentText.length > 0 && !currentText.endsWith('\n') ? '\n' : '';
  return `${leadingNewline}${body}\n---\n`;
}

export function composeInjection(currentText: string, body: string): string {
  return currentText + buildInsertion(currentText, body);
}

export function isEditableElement(element: Element | null): element is HTMLElement {
  if (!element || !(element instanceof HTMLElement)) return false;

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (element instanceof HTMLInputElement) {
    return (
      TEXT_INPUT_TYPES.has((element.type || 'text').toLowerCase()) &&
      !element.disabled &&
      !element.readOnly
    );
  }

  return element.isContentEditable || element.getAttribute('contenteditable') === 'true';
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;

  const view = element.ownerDocument.defaultView;
  if (!view) return true;

  const style = view.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  return (
    rect.bottom > 0 &&
    rect.top < view.innerHeight &&
    rect.right > 0 &&
    rect.left < view.innerWidth
  );
}

function scoreCandidate(element: HTMLElement, viewportWidth: number, viewportHeight: number): number {
  const rect = element.getBoundingClientRect();
  const area = Math.min(rect.width * rect.height, 100_000) / 100_000;
  const bottomDistance = Math.abs(viewportHeight - rect.bottom) / Math.max(viewportHeight, 1);
  const centerDistance =
    Math.abs(rect.left + rect.width / 2 - viewportWidth / 2) / Math.max(viewportWidth, 1);
  return area * 2 - bottomDistance - centerDistance * 0.5;
}

export function findTarget(
  doc: Document,
  lastFocused: HTMLElement | null,
): HTMLElement | null {
  if (
    lastFocused &&
    lastFocused.isConnected &&
    isEditableElement(lastFocused) &&
    isVisibleElement(lastFocused)
  ) {
    return lastFocused;
  }

  const candidates = Array.from(doc.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)).filter(
    (element) => isEditableElement(element) && isVisibleElement(element),
  );

  if (candidates.length === 0) return null;

  const view = doc.defaultView;
  const viewportWidth = view?.innerWidth ?? 0;
  const viewportHeight = view?.innerHeight ?? 0;
  return (
    candidates.sort(
      (a, b) =>
        scoreCandidate(b, viewportWidth, viewportHeight) -
        scoreCandidate(a, viewportWidth, viewportHeight),
    )[0] ?? null
  );
}

function dispatchInput(element: HTMLElement, data: string): void {
  const InputEventCtor = element.ownerDocument.defaultView?.InputEvent;
  const event = InputEventCtor
    ? new InputEventCtor('input', { bubbles: true, inputType: 'insertText', data })
    : new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

function insertIntoTextField(element: HTMLTextAreaElement | HTMLInputElement, body: string): boolean {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  const currentText = element.value;
  const insertion = buildInsertion(currentText, body);
  const nextText = currentText + insertion;

  setter?.call(element, nextText);
  dispatchInput(element, insertion);
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.setSelectionRange(nextText.length, nextText.length);
  return element.value === nextText;
}

function insertIntoContentEditable(element: HTMLElement, body: string): boolean {
  element.focus();

  const selection = element.ownerDocument.defaultView?.getSelection();
  if (selection) {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const before = element.textContent ?? '';
  const insertion = buildInsertion(before, body);
  let inserted = false;

  if (typeof element.ownerDocument.execCommand === 'function') {
    try {
      inserted = element.ownerDocument.execCommand('insertText', false, insertion);
    } catch {
      inserted = false;
    }
  }

  if (!inserted) {
    element.appendChild(element.ownerDocument.createTextNode(insertion));
    const InputEventCtor = element.ownerDocument.defaultView?.InputEvent;
    const beforeInput = InputEventCtor
      ? new InputEventCtor('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: insertion,
        })
      : new Event('beforeinput', { bubbles: true, cancelable: true });
    element.dispatchEvent(beforeInput);
    dispatchInput(element, insertion);
  }

  return (element.textContent ?? '').length > before.length;
}

export function insertIntoField(target: HTMLElement, body: string): boolean {
  target.focus();

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return insertIntoTextField(target, body);
  }

  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
    return insertIntoContentEditable(target, body);
  }

  return false;
}

export function flashElement(target: HTMLElement): void {
  const previousOutline = target.style.outline;
  const previousOffset = target.style.outlineOffset;
  target.style.outline = '2px solid #C9B77B';
  target.style.outlineOffset = '2px';
  setTimeout(() => {
    target.style.outline = previousOutline;
    target.style.outlineOffset = previousOffset;
  }, 700);
}

export function handleInjectRequest(
  doc: Document,
  lastFocused: HTMLElement | null,
  body: string,
): InjectResponse {
  const target = findTarget(doc, lastFocused);

  if (!target) {
    return { ok: false, error: 'No editable input found on this page.' };
  }

  if (!insertIntoField(target, body)) {
    return { ok: false, error: 'Could not insert the prompt on this page.' };
  }

  flashElement(target);
  return { ok: true };
}

export function startInjectionContentScript(): void {
  let lastFocused: HTMLElement | null = null;

  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && isEditableElement(target)) {
        lastFocused = target;
      }
    },
    true,
  );

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return;
    const request = message as { type?: unknown; text?: unknown };
    if (request.type !== INJECT_MESSAGE || typeof request.text !== 'string') return;
    sendResponse(handleInjectRequest(document, lastFocused, request.text));
  });
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run:
```bash
bun run test -- src/features/prompts/prompts.content.test.ts
```
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types/injection.ts src/features/prompts/prompts.content.ts src/features/prompts/prompts.content.test.ts
git commit -m "feat: inject prompts into textareas and contenteditable fields"
```
---

### Task 7: Content-script entrypoint and manifest permissions

**Files:**
- Modify: `src/entrypoints/content.ts`
- Modify: `wxt.config.ts`

**Interfaces:**
- Consumes: `startInjectionContentScript()` from Task 6.
- Produces: a built MV3 manifest with the content script on `http`/`https` and `storage` permission.

- [ ] **Step 1: Wire the content script entrypoint**

Replace `src/entrypoints/content.ts` with:

```ts
import { startInjectionContentScript } from '../features/prompts/prompts.content';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    startInjectionContentScript();
  },
});
```

- [ ] **Step 2: Add manifest permissions**

Replace `wxt.config.ts` with:

```ts
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],

  entrypointsDir: 'src/entrypoints',
  srcDir: 'src',

  manifest: {
    permissions: ['storage'],
    host_permissions: ['<all_urls>'],
  },

  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
```

- [ ] **Step 3: Build and inspect the manifest**

Run:
```bash
bun run build
python3 - <<'PY'
import json
manifest = json.load(open('.output/chrome-mv3/manifest.json'))
print('permissions:', manifest.get('permissions'))
print('host_permissions:', manifest.get('host_permissions'))
print('content_scripts:', manifest.get('content_scripts'))
PY
```

Expected output includes `permissions: ['storage']`, `host_permissions` containing `<all_urls>`, and a content script matching `http://*/*` and `https://*/*`.

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/content.ts wxt.config.ts
git commit -m "feat: register prompt injection content script"
```

---

### Task 8: Pixel-faithful popup view, font, and styles

**Files:**
- Create: `public/fonts/gelica.otf`
- Create: `src/features/prompts/prompts.ui.css`
- Create: `src/features/prompts/prompts.ui.tsx`
- Modify: `src/entrypoints/popup/style.css`
- Modify: `src/entrypoints/popup/App.tsx`

**Interfaces:**
- Consumes: `Prompt` from Task 1; `resolveIcon` from Task 3.
- Produces:
  - `type PromptsViewProps`
  - `PromptsView(props: PromptsViewProps): JSX.Element`

- [ ] **Step 1: Extract the embedded Gelica font**

Run:
```bash
mkdir -p public/fonts
python3 - <<'PY'
import base64, gzip, json, re
source = open('public/design/Popup.html', encoding='utf-8').read()
manifest = json.loads(
    re.search(r'<script type="__bundler/manifest">(.*?)</script>', source, re.S).group(1)
)
entry = manifest['86b6ac1a-d949-4399-8fdc-543502f837ce']
raw = base64.b64decode(entry['data'])
data = gzip.decompress(raw) if entry.get('compressed') else raw
open('public/fonts/gelica.otf', 'wb').write(data)
print('wrote', len(data), 'bytes')
PY
```
Expected: `wrote` with a positive byte count and `file public/fonts/gelica.otf` reports OpenType font data.

- [ ] **Step 2: Create the exact design styles**

Create `src/features/prompts/prompts.ui.css`:

```css
@font-face {
  font-family: 'Gelica';
  src: url('/fonts/gelica.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

* {
  box-sizing: border-box;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 60px;
  box-sizing: border-box;
  padding: 0 22px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #353929;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.row:hover {
  background: #1d1f18;
}

.row:focus-visible {
  outline: 2px solid #c9b77b;
  outline-offset: -2px;
  background: #1d1f18;
}

.iconbtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: transparent;
  border: 0;
  color: #a3a692;
  cursor: pointer;
  border-radius: 2px;
}

.iconbtn:hover {
  color: #e6e4d6;
  background: #262922;
}

.iconbtn:focus-visible {
  outline: 2px solid #c9b77b;
  outline-offset: -2px;
}

.search::placeholder {
  color: #8f937f;
  font-style: normal;
}

.search:focus {
  outline: none;
}

.searchwrap:focus-within {
  border-bottom-color: #c9b77b;
}

.list::-webkit-scrollbar {
  width: 8px;
}

.list::-webkit-scrollbar-thumb {
  background: #3a3e2f;
  border-radius: 4px;
}

.list::-webkit-scrollbar-track {
  background: transparent;
}
```

- [ ] **Step 3: Size the popup body exactly**

Replace `src/entrypoints/popup/style.css` with:

```css
@import "tailwindcss";

html,
body,
#root {
  width: 404px;
  height: 584px;
  margin: 0;
  overflow: hidden;
  background: #1d1f18;
}
```

- [ ] **Step 4: Create the popup view**

Create `src/features/prompts/prompts.ui.tsx`:

```tsx
import { useEffect, useRef, type CSSProperties } from 'react';
import type { Prompt } from '../../shared/types/prompt';
import { resolveIcon } from './prompts.icon';
import './prompts.ui.css';

const ACCENT = '#C9B77B';
const MUTED = '#A3A692';
const TEXT = '#E6E4D6';

const emptyTextStyle: CSSProperties = {
  margin: 0,
  padding: '36px 22px',
  fontSize: 16,
  color: MUTED,
};

function ReloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={MUTED}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export type PromptsViewProps = {
  title: string;
  count: number;
  query: string;
  onQueryChange: (value: string) => void;
  items: Prompt[];
  activeId: string | null;
  status: string | null;
  emptyMessage: string | null;
  onReload: () => void;
  onChooseFolder: () => void;
  onInject: (prompt: Prompt) => void;
};

export function PromptsView({
  title,
  count,
  query,
  onQueryChange,
  items,
  activeId,
  status,
  emptyMessage,
  onReload,
  onChooseFolder,
  onInject,
}: PromptsViewProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        width: 404,
        height: 584,
        boxSizing: 'border-box',
        padding: 12,
        background: '#1D1F18',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          background: '#262922',
          border: '1px solid #3A3E2F',
          borderRadius: 6,
          color: TEXT,
          fontFamily: "'Gelica', Georgia, serif",
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px 6px 22px',
            background: '#1D1F18',
            borderBottom: '1px solid #353929',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 400,
                letterSpacing: '0.01em',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h1>
            <span style={{ fontSize: 12, color: MUTED }}>{count} files</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
            <button
              type="button"
              className="iconbtn"
              aria-label="Reload files"
              title="Reload files"
              onClick={onReload}
            >
              <ReloadIcon />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="Choose folder"
              title="Choose folder"
              onClick={onChooseFolder}
            >
              <FolderIcon />
            </button>
          </div>
        </header>

        {status ? (
          <p style={{ margin: 0, padding: '0 22px 8px', fontSize: 12, color: '#D4A373' }}>
            {status}
          </p>
        ) : null}

        <div style={{ padding: '14px 22px 6px' }}>
          <label
            className="searchwrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 40,
              borderBottom: '1px solid #4A4F3C',
            }}
          >
            <SearchIcon />
            <input
              ref={searchRef}
              className="search"
              type="text"
              aria-label="Search prompts"
              placeholder="Find a prompt"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                background: 'transparent',
                border: 0,
                color: TEXT,
                fontFamily: "'Gelica', Georgia, serif",
                fontSize: 16,
              }}
            />
          </label>
        </div>

        <div className="list" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {emptyMessage ? (
            <p style={emptyTextStyle}>{emptyMessage}</p>
          ) : (
            items.map((prompt) => {
              const active = activeId === prompt.id;
              const Icon = resolveIcon(prompt.iconName);

              return (
                <button
                  key={prompt.id}
                  type="button"
                  className="row"
                  aria-label={`Inject ${prompt.name}`}
                  onClick={() => onInject(prompt)}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      flex: 'none',
                      color: active ? ACCENT : MUTED,
                    }}
                  >
                    <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                  </span>

                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 17,
                        lineHeight: 1.25,
                        color: active ? ACCENT : TEXT,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {prompt.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: MUTED,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {prompt.fileName}
                    </span>
                  </span>

                  {active ? (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flex: 'none',
                        fontSize: 12,
                        color: ACCENT,
                      }}
                    >
                      <CheckIcon />
                      Injected
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Render sample data for visual comparison**

Replace `src/entrypoints/popup/App.tsx` with temporary sample data:

```tsx
import type { Prompt } from '../../shared/types/prompt';
import { PromptsView } from '../../features/prompts/prompts.ui';

const samplePrompts: Prompt[] = [
  {
    id: 'code-review.md',
    name: 'Senior code reviewer',
    iconName: 'code-xml',
    body: 'Review this code.',
    fileName: 'code-review.md',
    relativePath: 'code-review.md',
  },
  {
    id: 'explain-simply.md',
    name: 'Explain it like I’m new',
    iconName: 'lightbulb',
    body: 'Explain this simply.',
    fileName: 'explain-simply.md',
    relativePath: 'explain-simply.md',
  },
  {
    id: 'refactor.md',
    name: 'Refactor for clarity',
    iconName: 'refresh-cw',
    body: 'Refactor this.',
    fileName: 'refactor.md',
    relativePath: 'refactor.md',
  },
];

export default function App() {
  return (
    <PromptsView
      title="Prompt Shelf"
      count={12}
      query=""
      onQueryChange={() => undefined}
      items={samplePrompts}
      activeId={null}
      status={null}
      emptyMessage={null}
      onReload={() => undefined}
      onChooseFolder={() => undefined}
      onInject={() => undefined}
    />
  );
}
```

- [ ] **Step 6: Build and compare against the design by inch**

Run:
```bash
bun run build
```
Load `.output/chrome-mv3` as an unpacked extension and open the popup. Also open `public/design/Popup.html` directly in the browser. Compare at 1:1:

- Window is 404 × 584 with 12px dark padding.
- Card border, radius, and background match.
- Header title is 20px Gelica, subtitle 12px muted, buttons 44 × 44.
- Search underline, icon, placeholder, and 16px input match.
- Rows are 60px minimum, 22px icons, 17px titles, 12px filenames, 1px separators.
- Hover, focus ring, and scrollbar match.

Fix any visual difference before committing.

- [ ] **Step 7: Commit**

```bash
git add public/fonts/gelica.otf src/features/prompts/prompts.ui.css src/features/prompts/prompts.ui.tsx src/entrypoints/popup/style.css src/entrypoints/popup/App.tsx
git commit -m "feat: build popup view from the design"
```
---

### Task 9: Popup behavior — snapshot, folder actions, search, inject

**Files:**
- Create: `src/features/prompts/prompts.use.ts`
- Modify: `src/features/prompts/prompts.ui.tsx`
- Modify: `src/entrypoints/popup/App.tsx`

**Interfaces:**
- Consumes:
  - `filterPrompts`, `sortPrompts` from Task 2.
  - `loadSnapshot`, `saveSnapshot`, `loadLibraryHandle`, `saveLibraryHandle` from Task 4.
  - `chooseLibraryFolder`, `ensureReadPermission`, `buildSnapshot` from Task 5.
  - `INJECT_MESSAGE`, `InjectResponse` from Task 6.
  - `PromptsView` from Task 8.
- Produces: `usePrompts()` and `PromptsPopup()`.

- [ ] **Step 1: Implement the state hook**

Create `src/features/prompts/prompts.use.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Prompt, PromptSnapshot } from '../../shared/types/prompt';
import { INJECT_MESSAGE, type InjectResponse } from '../../shared/types/injection';
import { filterPrompts, sortPrompts } from './prompts.filter';
import {
  buildSnapshot,
  chooseLibraryFolder,
  ensureReadPermission,
} from './prompts.files';
import {
  loadLibraryHandle,
  loadSnapshot,
  saveLibraryHandle,
  saveSnapshot,
} from './prompts.storage';

export function usePrompts() {
  const [snapshot, setSnapshot] = useState<PromptSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const activeTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadSnapshot()
      .then((stored) => {
        if (alive) setSnapshot(stored);
      })
      .catch(() => {
        if (alive) setStatus('Could not read saved prompts.');
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (activeTimer.current) window.clearTimeout(activeTimer.current);
    };
  }, []);

  const prompts = useMemo(() => sortPrompts(snapshot?.prompts ?? []), [snapshot]);
  const items = useMemo(() => filterPrompts(prompts, query), [prompts, query]);

  const emptyMessage = !loaded
    ? null
    : !snapshot
      ? 'Choose a folder to begin.'
      : prompts.length === 0
        ? 'No prompts in this folder.'
        : items.length === 0
          ? 'Nothing matches that.'
          : null;

  const persist = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const { snapshot: next, capped } = await buildSnapshot(handle);
    await saveLibraryHandle(handle);
    await saveSnapshot(next);
    setSnapshot(next);
    setStatus(capped ? 'Some prompts were skipped (scan limit).' : null);
  }, []);

  const chooseFolder = useCallback(async () => {
    setStatus(null);
    try {
      const handle = await chooseLibraryFolder();
      if (!handle) return;
      await persist(handle);
    } catch {
      setStatus('Could not open that folder.');
    }
  }, [persist]);

  const reload = useCallback(async () => {
    setStatus(null);
    try {
      const handle = await loadLibraryHandle();
      if (!handle) {
        await chooseFolder();
        return;
      }
      if (!(await ensureReadPermission(handle))) {
        setStatus('Folder unavailable — choose it again.');
        return;
      }
      await persist(handle);
    } catch {
      setStatus('Folder unavailable — choose it again.');
    }
  }, [chooseFolder, persist]);

  const inject = useCallback(async (prompt: Prompt) => {
    if (activeTimer.current) window.clearTimeout(activeTimer.current);
    setActiveId(prompt.id);
    activeTimer.current = window.setTimeout(() => setActiveId(null), 2200);
    setStatus(null);

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');

      const response = await Promise.race<InjectResponse>([
        browser.tabs.sendMessage(tab.id, {
          type: INJECT_MESSAGE,
          text: prompt.body,
        }) as Promise<InjectResponse>,
        new Promise<InjectResponse>((_resolve, reject) => {
          setTimeout(() => reject(new Error('timeout')), 2000);
        }),
      ]);

      if (!response.ok) {
        setStatus(response.error);
        return;
      }

      window.close();
    } catch {
      setStatus("Can't inject on this page.");
    }
  }, []);

  return {
    title: snapshot?.folderName ?? 'Prompt Slinger',
    count: prompts.length,
    query,
    onQueryChange: setQuery,
    items,
    activeId,
    status,
    emptyMessage,
    onReload: reload,
    onChooseFolder: chooseFolder,
    onInject: inject,
  };
}
```

- [ ] **Step 2: Add the container component to the UI module**

In `src/features/prompts/prompts.ui.tsx`, add this import after the `resolveIcon` import:

```tsx
import { usePrompts } from './prompts.use';
```

Append this at the end of the file:

```tsx
export function PromptsPopup() {
  const view = usePrompts();
  return <PromptsView {...view} />;
}
```

- [ ] **Step 3: Replace the temporary sample App**

Replace `src/entrypoints/popup/App.tsx` with:

```tsx
import { PromptsPopup } from '../../features/prompts/prompts.ui';

export default function App() {
  return <PromptsPopup />;
}
```

- [ ] **Step 4: Run the full automated suite**

Run:
```bash
bun run test
```
Expected: PASS, all test files.

- [ ] **Step 5: Compile and build**

Run:
```bash
bun run compile
bun run build
```
Expected: no TypeScript errors, successful build.

- [ ] **Step 6: Manual behavior verification**

Load `.output/chrome-mv3` as an unpacked extension, then verify:

1. First open shows `Prompt Slinger`, `0 files`, and `Choose a folder to begin.`
2. Clicking the folder button opens the picker; choosing a folder shows its name as the title and the parsed prompt count as the subtitle.
3. Rows show the Lucide icon from `icon-name`, the frontmatter name, and the filename; an unknown icon shows `file-text`.
4. Typing filters live; a miss shows `Nothing matches that.`
5. On ChatGPT, Claude, and DeepSeek, clicking a row appends the body plus `\n---\n`, flashes the composer, and closes the popup.
6. On a page with no composer, the popup stays open and shows `No editable input found on this page.`
7. Editing a markdown file on disk and clicking Reload updates the list.
8. Denying/revoking folder access on Reload keeps the previous list and shows `Folder unavailable — choose it again.`

- [ ] **Step 7: Commit**

```bash
git add src/features/prompts/prompts.use.ts src/features/prompts/prompts.ui.tsx src/entrypoints/popup/App.tsx
git commit -m "feat: wire popup snapshot, folder actions, search, and injection"
```

---

### Task 10: Feature documentation and final verification

**Files:**
- Create: `src/features/prompts/README.md`
- Modify: `src/features/prompts/index.ts` (create it if absent)

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces: a documented feature module and a final green verification run.

- [ ] **Step 1: Document the feature module**

Create `src/features/prompts/README.md`:

```markdown
# Prompts Feature

Reads Markdown prompts from a user-picked folder and injects them into the
focused composer on any AI chat page.

## Files

| File | Context | Responsibility |
| --- | --- | --- |
| `prompts.parse.ts` | shared | Frontmatter parsing and fallback rules |
| `prompts.filter.ts` | shared | Name/filename search and sorting |
| `prompts.icon.ts` | popup | Kebab-case Lucide lookup with `file-text` fallback |
| `prompts.storage.ts` | popup | Snapshot in `chrome.storage.local`; handle in IndexedDB |
| `prompts.files.ts` | popup | Directory picker, permissions, recursive scan |
| `prompts.ui.tsx` | popup | Design-faithful popup view and container |
| `prompts.use.ts` | popup | Snapshot/folder/injection state |
| `prompts.content.ts` | content | Focus tracking, detection, insertion, flash |

## Data flow

1. Choose folder → `showDirectoryPicker` → recursive `.md` scan.
2. Parsed prompts + folder name → `chrome.storage.local`.
3. Directory handle → IndexedDB.
4. Popup opens from the snapshot only.
5. Row click → `INJECT_PROMPT` message → content script inserts
   `body + "\n---\n"`, flashes, ACKs → popup closes.

## Invariants

- Never write to the prompt folder.
- Never send prompt content over the network.
- Frontmatter is never injected.
- A failed injection keeps the popup open with a status message.
- The design source of truth is `public/design/Popup.html`.
```

- [ ] **Step 2: Add the feature barrel**

Create `src/features/prompts/index.ts`:

```ts
export { PromptsPopup, PromptsView } from './prompts.ui';
export { usePrompts } from './prompts.use';
export { parsePrompt } from './prompts.parse';
export { filterPrompts, sortPrompts } from './prompts.filter';
export { resolveIcon } from './prompts.icon';
export { scanDirectory } from './prompts.files';
export { startInjectionContentScript } from './prompts.content';
```

- [ ] **Step 3: Run the complete verification**

Run:
```bash
bun run test
bun run compile
bun run build
```
Expected:
- All Vitest suites pass.
- `tsc --noEmit` exits with no errors.
- WXT build succeeds.

- [ ] **Step 4: Final design audit**

Compare the built popup against `public/design/Popup.html` one more time at 404 × 584. Confirm every value from the Global Constraints section. Do not commit with a visual difference.

- [ ] **Step 5: Commit**

```bash
git add src/features/prompts/README.md src/features/prompts/index.ts
git commit -m "docs: document the prompts feature"
```
