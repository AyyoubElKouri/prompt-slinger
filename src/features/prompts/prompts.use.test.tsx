// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptSnapshot } from '../../shared/types/prompt';

const mocks = vi.hoisted(() => ({
  loadSnapshot: vi.fn(),
  createTab: vi.fn(),
  executeScript: vi.fn(),
  queryTabs: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      query: mocks.queryTabs,
      sendMessage: mocks.sendMessage,
      create: mocks.createTab,
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://test${path}`,
    },
    scripting: {
      executeScript: mocks.executeScript,
    },
  },
}));

vi.mock('./prompts.storage', () => ({
  loadSnapshot: mocks.loadSnapshot,
}));

import { usePrompts } from './prompts.use';

const snapshot: PromptSnapshot = {
  version: 1,
  folderName: 'Shelf',
  scannedAt: 1,
  prompts: [
    {
      id: 'review.md',
      name: 'Review',
      iconName: 'code-xml',
      body: 'Review this',
      fileName: 'review.md',
      relativePath: 'review.md',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadSnapshot.mockResolvedValue(snapshot);
  mocks.createTab.mockResolvedValue({});
  mocks.executeScript.mockResolvedValue([]);
});

async function loadedHook() {
  const hook = renderHook(() => usePrompts());
  await waitFor(() => expect(hook.result.current.count).toBe(1));
  return hook;
}

describe('usePrompts', () => {
  it('renders the stored snapshot without touching the filesystem', async () => {
    const { result } = await loadedHook();
    expect(result.current.title).toBe('Shelf');
    expect(result.current.items.map((prompt) => prompt.name)).toEqual(['Review']);
  });

  it('stays open and reports a failed injection', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    mocks.queryTabs.mockResolvedValue([{ id: 1 }]);
    mocks.sendMessage.mockResolvedValue({ ok: false, error: 'No editable input found on this page.' });
    const { result } = await loadedHook();

    await act(async () => {
      await result.current.onInject(snapshot.prompts[0]!);
    });

    expect(result.current.status).toBe('No editable input found on this page.');
    expect(result.current.activeId).toBeNull();
    expect(close).not.toHaveBeenCalled();
    close.mockRestore();
  });

  it('closes only after the content script acknowledges', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    mocks.queryTabs.mockResolvedValue([{ id: 1 }]);
    mocks.sendMessage.mockResolvedValue({ ok: true });
    const { result } = await loadedHook();

    await act(async () => {
      await result.current.onInject(snapshot.prompts[0]!);
    });

    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
  });

  it('reconnects to an open tab whose content script was orphaned', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    mocks.queryTabs.mockResolvedValue([{ id: 1 }]);
    mocks.sendMessage
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce({ ok: true });
    const { result } = await loadedHook();

    await act(async () => {
      await result.current.onInject(snapshot.prompts[0]!);
    });

    expect(mocks.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      files: ['/content-scripts/content.js'],
    });
    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
  });

  it('always opens the picker tab from the popup', async () => {
    const { result } = await loadedHook();

    await act(async () => {
      await result.current.onChooseFolder();
    });

    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://test/picker.html',
    });
  });
});
