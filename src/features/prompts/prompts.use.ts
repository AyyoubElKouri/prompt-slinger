import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Prompt, PromptSnapshot } from '../../shared/types/prompt';
import { INJECT_MESSAGE, type InjectResponse } from '../../shared/types/injection';
import { filterPrompts, sortPrompts } from './prompts.filter';
import { loadSnapshot } from './prompts.storage';

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

  const openPickerTab = useCallback(async () => {
    await browser.tabs.create({ url: browser.runtime.getURL('/picker.html') });
  }, []);

  const chooseFolder = useCallback(async () => {
    setStatus(null);
    try {
      // Never call a native picker from the action popup: the popup is torn
      // down when the dialog takes focus, which crashes Brave and loses the
      // selection in Chrome. The picker tab is a normal page and is safe.
      await openPickerTab();
    } catch {
      setStatus('Could not open that folder.');
    }
  }, [openPickerTab]);

  const inject = useCallback(async (prompt: Prompt) => {
    if (activeTimer.current) window.clearTimeout(activeTimer.current);
    setActiveId(prompt.id);
    activeTimer.current = window.setTimeout(() => setActiveId(null), 2200);
    setStatus(null);

    const clearActive = () => {
      if (activeTimer.current) {
        window.clearTimeout(activeTimer.current);
        activeTimer.current = null;
      }
      setActiveId(null);
    };

    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      if (!tabId) throw new Error('No active tab');

      const ask = () =>
        Promise.race<InjectResponse>([
          browser.tabs.sendMessage(tabId, {
            type: INJECT_MESSAGE,
            text: prompt.body,
          }) as Promise<InjectResponse>,
          new Promise<InjectResponse>((_resolve, reject) => {
            setTimeout(() => reject(new Error('timeout')), 2000);
          }),
        ]);

      let response: InjectResponse;
      try {
        response = await ask();
      } catch {
        // An extension reload orphans the content script in already-open tabs.
        // Re-inject it once so the user does not need to refresh the page.
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['/content-scripts/content.js'],
        });
        response = await ask();
      }

      if (!response.ok) {
        clearActive();
        setStatus(response.error);
        return;
      }

      window.close();
    } catch {
      clearActive();
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
    onChooseFolder: chooseFolder,
    onInject: inject,
  };
}
