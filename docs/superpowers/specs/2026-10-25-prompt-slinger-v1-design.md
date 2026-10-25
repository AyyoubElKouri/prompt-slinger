# Prompt Slinger v1 — Design

- **Date:** 2026-10-25
- **Status:** Approved design, ready for implementation planning
- **Supersedes:** `docs/Prompt Slinger Spec.md` (historical reference only)

## 1. Purpose

Prompt Slinger is a Chromium extension that injects reusable prompts into the
composer of any AI chat web app. The user keeps prompts as Markdown files in a
local folder they control. The extension is read-only: it never writes to that
folder, never sends prompt content anywhere, and has no backend.

## 2. Scope

### In scope for v1

- One user-picked prompts folder, stored as a browser-side snapshot.
- Recursive scan for `.md` files, displayed as one flat list.
- Popup UI matching `public/design/Popup.html` exactly.
- Frontmatter with `name` and `icon-name`; Lucide icon rendering.
- Live search over prompt name and filename.
- Click-to-inject into the focused chat input on any site.
- Injection feedback flash and automatic popup close.
- Explicit Reload action that re-scans the folder.
- Stale snapshot kept when folder permission is unavailable.

### Out of scope for v1

- Multiple libraries, folder trees, or folder grouping in the UI.
- Prompt variables, full-text search, tags, or description fields.
- In-extension create, edit, delete, rename, move, or duplicate actions.
- i18n, theme switching, accent swatches.
- Centered modal overlay or in-page `/` trigger.
- Per-site curated adapters.
- Cloud sync, analytics, telemetry, network requests.
- Firefox or non-Chromium browsers.

## 3. User flows

### 3.1 First open (no snapshot)

The popup opens at 404 × 584 showing the design chrome, an empty list area with
`Choose a folder to begin.`, and the two header buttons. Clicking the folder
button opens the native directory picker.

### 3.2 Choosing a folder

1. If the browser exposes `showDirectoryPicker`, it runs from the click
   gesture.
2. Otherwise — including on extension pages where Chromium does not expose
   the File System Access picker APIs — a hidden
   `<input type="file" webkitdirectory multiple>` is opened. The folder name
   comes from `webkitRelativePath`, and only `.md` files are kept.
3. The folder is scanned recursively for `.md` files.
4. The parsed prompts, folder name, and scan time are written to
   `chrome.storage.local`.
5. When a directory handle exists, it is written to IndexedDB. The input
   fallback has no handle to persist.
6. The popup renders the folder name as the header title and the prompt count
   as the subtitle.

### 3.3 Opening the popup later

The popup reads only the stored snapshot. It does not touch the filesystem and
never prompts for permission on open. Rendering is immediate.

### 3.4 Injecting a prompt

1. The user clicks a row.
2. The popup sends the prompt body to the active tab's content script.
3. The content script inserts the text into the tracked chat input, applies the
   flash, and acknowledges.
4. The popup closes.
5. On failure, the popup stays open and shows the error in a one-line status
   under the header; the prompt list remains usable.

### 3.5 Reloading

1. The user clicks Reload.
2. If a saved handle exists, the extension checks `queryPermission`.
3. If permission is not granted, it calls `requestPermission` from the click
   gesture.
4. On success, the folder is re-scanned and the snapshot replaced.
5. On denial, deletion, or a missing handle, the stale snapshot remains visible
   with the status line `Folder unavailable — choose it again.`
6. Without a directory handle (input fallback), Reload reopens the directory
   input and replaces the snapshot after the user picks the folder again.

## 4. Popup UI specification

The source of truth is `public/design/Popup.html`. The implementation must match
its layout, spacing, typography, colors, hover/focus states, and scrollbar
styling.

### 4.1 Window and card

| Property | Value |
| --- | --- |
| Window | 404 × 584 |
| Outer background | `#1D1F18` |
| Outer padding | 12px |
| Card background | `#262922` |
| Card border | 1px solid `#3A3E2F` |
| Card radius | 6px |
| Card overflow | hidden |
| Base text | `#E6E4D6` |
| Font | Gelica OTF, fallback `Georgia, serif` |

The Gelica OTF embedded in `Popup.html` is extracted to `public/fonts/` and
loaded with `@font-face`.

### 4.2 Header

- Container: `display:flex; align-items:center; justify-content:space-between;
  padding:6px 10px 6px 22px; background:#1D1F18;
  border-bottom:1px solid #353929`.
- Title: the picked folder's name, or `Prompt Slinger` before a folder is
  chosen. 20px, weight 400, letter-spacing 0.01em, line-height 1.2, color
  `#E6E4D6`. It truncates with an ellipsis when the folder name is too long.
- Subtitle: the number of parsed prompts (for example `12 files`), 12px,
  color `#A3A692`.
- Two 44 × 44 icon buttons with 18 × 18 SVGs, stroke 1.6:
  - **Reload files** — the exact circular-arrow path from the design.
  - **Choose folder** — the exact folder path from the design.
- Buttons use `#A3A692`; hover `#E6E4D6` on `#262922`; focus outline
  `2px solid #C9B77B` with offset `-2px`.

### 4.3 Search

- Wrapper: `padding:14px 22px 6px`.
- Field: 40px high, flex, gap 10px, bottom border `1px solid #4A4F3C`.
- Icon: 16 × 16 search SVG, stroke `#A3A692`, stroke-width 1.6.
- Input: flex 1, transparent, no border, 16px Gelica, color `#E6E4D6`.
- Placeholder `Find a prompt`, color `#8F937F`, normal style.
- Focus removes the input outline and changes the wrapper's bottom border to
  `#C9B77B`.

### 4.4 Prompt list

- Container: `flex:1; min-height:0; overflow-y:auto`.
- Scrollbar: width 8px, thumb `#3A3E2F` radius 4px, transparent track.
- One row per prompt, 60px min-height, `padding:0 22px`, gap 16px,
  bottom border `1px solid #353929`, transparent background.
- Row hover and keyboard-focus background: `#1D1F18`.
- Row focus-visible outline: `2px solid #C9B77B`, offset `-2px`.
- Icon slot: 22 × 22, Lucide stroke-width 1.5, color `#A3A692`
  (accent `#C9B77B` in the injected state).
- Title: 17px, line-height 1.25, single-line ellipsis.
- Filename: 12px, `#A3A692`, single-line ellipsis.
- Injected state: title and icon become `#C9B77B`; a right-aligned
  `Injected` label with a 14 × 14 check icon appears. The state is applied
  optimistically on click. Because a successful injection closes the popup,
  it is normally visible only for the message round-trip; it is part of the
  design and remains implemented.
- Rows are sorted by `name`, then filename, using locale-aware comparison.

### 4.5 States

All list-state messages reuse the list-area typography
(`margin:0; padding:36px 22px; font-size:16px; color:#A3A692`).
Failures that must not replace the list render as a one-line status under the
header (`padding:0 22px 8px; font-size:12px; color:#D4A373`).

| Condition | Where | Message |
| --- | --- | --- |
| No snapshot | List | `Choose a folder to begin.` |
| Folder has no prompts | List | `No prompts in this folder.` |
| Search has no match | List | `Nothing matches that.` |
| No injectable input | Status | `No editable input found on this page.` |
| No content script / timeout | Status | `Can't inject on this page.` |
| Reload/permission failure | Status | `Folder unavailable — choose it again.` |

Search filters the list live as the user types. A row is visible when the
case-insensitive query is a substring of `name` or `fileName`.

## 5. Data model and parsing

```ts
export type Prompt = {
  id: string;           // relative path, stable key
  name: string;         // frontmatter name
  iconName: string;     // frontmatter icon-name, kebab-case
  body: string;         // markdown body only
  fileName: string;     // e.g. code-review.md
  relativePath: string; // e.g. Writing/code-review.md
};

export type PromptSnapshot = {
  version: 1;
  folderName: string;
  scannedAt: number; // epoch milliseconds
  prompts: Prompt[];
};
```

### Parsing rules

- A file starts with an optional YAML frontmatter block delimited by `---`
  lines. The block is parsed with the `yaml` package.
- `name`: used when it is a non-empty string; otherwise the filename without
  `.md`.
- `icon-name`: used when it is a non-empty string; otherwise `file-text`.
- `body`: everything after the closing delimiter, trimmed at both ends.
  Internal whitespace and line breaks are preserved.
- Malformed YAML does not fail the scan: the file is treated as having no
  frontmatter, so the whole file becomes the body and the filename becomes the
  name.
- Only `.md` files are considered. Files and folders whose names start with `.`
  are ignored.
- Subfolders are scanned recursively.
- Safety caps: 2,000 prompt files and depth 16. Reaching a cap stops the scan
  and reports it in the status line.

## 6. Storage and filesystem

### 6.1 Snapshot

- Stored in `chrome.storage.local` under `promptSlinger.snapshot.v1`.
- Written only after a successful scan.
- Read on every popup open.
- The stale snapshot is never cleared automatically by a failed reload.

### 6.2 Directory handle

- Stored in IndexedDB: database `prompt-slinger`, object store `handles`,
  key `library`.
- IndexedDB is required because `chrome.storage` cannot store file handles.
- The handle is used only by Reload and Choose folder. Normal popup opens never
  touch it.

### 6.3 Permission behavior

- Choose folder grants access through the native picker.
- Reload checks `queryPermission({ mode: "read" })`; if not granted, it calls
  `requestPermission({ mode: "read" })` inside the click handler.
- A denied or failed request leaves the snapshot untouched and surfaces the
  status line.
- A deleted or moved folder is handled the same way.

### 6.4 Storage limits

Prompt bodies live in `chrome.storage.local` with the default quota. There is no
`unlimitedStorage` permission in v1. If a write fails because the quota is
exceeded, the popup shows a status message and keeps the previous snapshot.

## 7. Injection

### 7.1 Content script

- Runs on `http` and `https` pages at `document_idle`, top frame only.
- Tracks the most recently focused editable element via a `focusin` listener.
- Handles one runtime message: `{ type: "INJECT_PROMPT", text: string }`.

### 7.2 Target selection

An element qualifies when it is connected, visible, enabled, and one of:

- `textarea`
- text-like `input` (`text`, `search`, `url`, or no type)
- `[contenteditable="true"]`
- `[role="textbox"]`

Selection order:

1. The last focused qualifying element, if it still qualifies.
2. Otherwise, score visible candidates by viewport visibility, area, and
   proximity to the bottom-center of the viewport. Pick the highest score.
3. If nothing qualifies, reply with an error.

### 7.3 Text composition

```ts
const suffix = `${promptBody}\n---\n`;
const needsLeadingNewline = currentText.length > 0 && !currentText.endsWith("\n");
const inserted = `${needsLeadingNewline ? "\n" : ""}${suffix}`;
const nextText = currentText + inserted;
```

- Frontmatter is never part of the injected text.
- Current text is read from the live element at injection time.
- The caret ends up after the inserted text.

### 7.4 Insertion

For `textarea` and text inputs:

1. Focus the element.
2. Set the value through the native prototype setter so framework state updates.
3. Dispatch a bubbling `input` event (`inputType: "insertText"`) and a
   `change` event.
4. Set the selection range to the end.

For contenteditable elements:

1. Focus the element.
2. Collapse the selection to the end of its contents.
3. Call `document.execCommand("insertText", false, text)`.
4. If that returns false, insert a text node at the end and dispatch
   `beforeinput` and `input`.
5. If insertion cannot be confirmed, reply with an error.

### 7.5 Flash

- Save the target's inline `outline` and `outline-offset`.
- Apply `outline: 2px solid #C9B77B; outline-offset: 2px`.
- Restore the saved values after 700ms.
- Acknowledge success immediately after applying the flash; do not wait for the
  restore.

### 7.6 Popup coordination

- Query the active tab in the current window.
- Send `INJECT_PROMPT` and await the reply with a 2-second timeout.
- On success, call `window.close()`.
- On error, timeout, or a missing content script, keep the popup open and show
  the error state. Never close silently on failure.

## 8. Manifest and permissions

- `permissions: ["storage"]`
- `host_permissions: ["<all_urls>"]` for the content script and injection
- Content script matches `http://*/*` and `https://*/*`
- No `scripting`, no `activeTab`, no `unlimitedStorage`
- No network calls, analytics, telemetry, or remote code

## 9. Code layout

```text
src/entrypoints/popup/App.tsx        renders the feature UI
src/entrypoints/content.ts           thin call into prompts.content
src/entrypoints/background.ts        unchanged minimal worker
src/features/prompts/
  prompts.parse.ts                   frontmatter, fallbacks, Prompt construction
  prompts.files.ts                   recursive scan, picker, reload
  prompts.storage.ts                 snapshot and IndexedDB handle persistence
  prompts.filter.ts                  name/filename search
  prompts.icon.ts                    kebab-case to Lucide component + fallback
  prompts.ui.tsx                     popup chrome, header, search, rows, states
  prompts.content.ts                 focus tracking, detection, insertion, flash
  README.md
  index.ts
src/shared/types/prompt.ts
```

- Entrypoints stay thin, per `AGENTS.md`.
- UI state is exposed through a single `usePrompts()` hook.
- Lucide resolution maps kebab-case names to the `lucide-react` icon map and
  imports all icons once at module load.

## 10. Dependencies

- Runtime: `lucide-react`, `yaml`
- Dev: `vitest`
- Assets: Gelica OTF extracted from the design into `public/fonts/`
- Styling: existing Tailwind is available, but the popup uses the design's exact
  values (inline/utility styles may be used as long as computed output matches).

## 11. Testing

Automated (Vitest, pure logic):

- Frontmatter parsing: valid, missing `name`, missing `icon-name`, malformed
  YAML, CRLF, no frontmatter.
- Text composition: empty input, non-empty input, input ending in a newline,
  exact separator.
- Search filtering and sorting.
- Icon name resolution and fallback.
- Snapshot round-trip with a mocked storage layer.

Manual verification:

- `bun run compile` and `bun run build` succeed.
- Load the unpacked extension, pick a folder, verify title/count/icons.
- Inject into ChatGPT, Claude, and DeepSeek; verify appended text and flash.
- Verify popup closes only on success and shows an error on unsupported pages.
- Reload after editing a file reflects changes.
- Reload after revoking access keeps the stale list and shows the status line.

## 12. Performance

- Popup render from snapshot: under 100ms for several hundred prompts.
- Filtering runs synchronously on each keystroke over the in-memory snapshot.
- Icon resolution is memoized per `icon-name`.
- Scanning runs only on Choose folder or Reload, never on popup open.

## 13. Risks and constraints

- Broad host access produces a prominent install permission warning. It is
  required for a generic injector.
- `document.execCommand` is deprecated but remains the most compatible way to
  insert rich text across current chat composers. The text-node fallback covers
  future removal.
- File System Access API is Chromium-only; Firefox is out of scope.
- Stored prompt bodies share the `storage.local` quota.
- A page that blocks content-script injection (browser pages, the Web Store)
  cannot receive prompts; this is reported as an error.

## 14. Acceptance criteria

1. Popup visually matches `public/design/Popup.html` at 404 × 584, including
   the Gelica font and both header icon buttons.
2. The header title is the chosen folder's name and the subtitle shows the
   prompt count.
3. All `.md` files in the folder and subfolders appear, sorted, with their
   frontmatter `name` and Lucide `icon-name`; unknown icons show `file-text`.
4. Search filters live by name and filename; the empty message is exact.
5. Clicking a row appends `body + "\n---\n"` to the focused chat input, flashes
   it, and closes the popup.
6. Failure to find an input keeps the popup open with a clear error.
7. Reload re-scans; denied permission keeps the stale snapshot and shows the
   status line.
8. No prompt content leaves the machine and no file or folder is ever written.
