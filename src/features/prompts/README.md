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
