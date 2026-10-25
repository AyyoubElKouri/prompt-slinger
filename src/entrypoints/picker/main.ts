import { browser } from 'wxt/browser';
import { chooseLibraryFiles, buildSnapshotFromFiles } from '../../features/prompts/prompts.files';
import { saveSnapshot } from '../../features/prompts/prompts.storage';

const button = document.querySelector<HTMLButtonElement>('#choose');
const status = document.querySelector<HTMLParagraphElement>('#status');

function setStatus(text: string, error = false) {
  if (!status) return;
  status.textContent = text;
  status.classList.toggle('error', error);
}

async function closeTab() {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id) await browser.tabs.remove(tab.id);
}

button?.addEventListener('click', async () => {
  if (!button) return;
  button.disabled = true;
  setStatus('Waiting for a folder…');

  try {
    const picked = await chooseLibraryFiles();
    if (!picked) {
      setStatus('No folder selected.');
      return;
    }

    const { snapshot, capped } = await buildSnapshotFromFiles(picked);
    await saveSnapshot(snapshot);

    const count = snapshot.prompts.length;
    setStatus(
      capped
        ? `Saved ${count} prompts (some were skipped at the scan limit). Closing…`
        : `Saved ${count} prompt${count === 1 ? '' : 's'}. Closing…`,
    );
    setTimeout(() => {
      void closeTab();
    }, 700);
  } catch {
    setStatus('Could not read that folder. Try another one.', true);
  } finally {
    if (document.body.contains(button)) button.disabled = false;
  }
});
