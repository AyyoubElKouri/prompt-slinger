import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Prompt, PromptSnapshot } from '../../shared/types/prompt';
import { INJECT_MESSAGE, type InjectResponse } from '../../shared/types/injection';
import { filterPrompts, sortPrompts } from './prompts.filter';
import { buildSnapshot, chooseLibraryFolder, ensureReadPermission } from './prompts.files';
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
