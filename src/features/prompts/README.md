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

1. Choose folder → open the `picker.html` extension tab with a
   `webkitdirectory` file input → recursive `.md` scan.
2. Parsed prompts + folder name → `chrome.storage.local`.
3. Directory handle → IndexedDB (fallback only).
4. Popup opens from the snapshot only.
5. Row click → `INJECT_PROMPT` message → content script inserts
   `body + "\n---\n"`, flashes, ACKs → popup closes.
6. Choosing a folder again replaces the snapshot.

## Picker tab

`src/entrypoints/picker/` is a full extension tab. The folder dialog runs
there, not in the popup, because invoking a native directory dialog from the
popup can close the browser on some Chromium builds (observed in Brave).

## Invariants

- Never write to the prompt folder.
- Never send prompt content over the network.
- Frontmatter is never injected.
- A failed injection keeps the popup open with a status message.
- The design source of truth is `public/design/Popup.html`.
