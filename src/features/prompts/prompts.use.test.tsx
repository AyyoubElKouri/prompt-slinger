// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptSnapshot } from '../../shared/types/prompt';

const mocks = vi.hoisted(() => ({
  loadSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  loadLibraryHandle: vi.fn(),
  saveLibraryHandle: vi.fn(),
  buildSnapshot: vi.fn(),
  createTab: vi.fn(),
  ensureReadPermission: vi.fn(),
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
  },
}));

vi.mock('./prompts.storage', () => ({
  loadSnapshot: mocks.loadSnapshot,
  saveSnapshot: mocks.saveSnapshot,
  loadLibraryHandle: mocks.loadLibraryHandle,
  saveLibraryHandle: mocks.saveLibraryHandle,
}));

vi.mock('./prompts.files', () => ({
  buildSnapshot: mocks.buildSnapshot,
  ensureReadPermission: mocks.ensureReadPermission,
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
  mocks.loadLibraryHandle.mockResolvedValue(null);
  mocks.createTab.mockResolvedValue({});
  mocks.ensureReadPermission.mockResolvedValue(true);
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
    expect(mocks.loadLibraryHandle).not.toHaveBeenCalled();
  });

  it('reopens the picker tab on reload when the handle is missing', async () => {
    const { result } = await loadedHook();

    await act(async () => {
      await result.current.onReload();
    });

    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://test/picker.html',
    });
    expect(result.current.count).toBe(1);
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

  it('always opens the picker tab from the popup', async () => {
    const { result } = await loadedHook();

    await act(async () => {
      await result.current.onChooseFolder();
    });

    expect(mocks.createTab).toHaveBeenCalledWith({
      url: 'chrome-extension://test/picker.html',
    });
  });

  it('keeps the stale snapshot when permission is denied', async () => {
    mocks.loadLibraryHandle.mockResolvedValue({ kind: 'directory', name: 'Shelf' } as unknown as FileSystemDirectoryHandle);
    mocks.ensureReadPermission.mockResolvedValue(false);
    const { result } = await loadedHook();

    await act(async () => {
      await result.current.onReload();
    });

    expect(result.current.status).toBe('Folder unavailable — choose it again.');
    expect(result.current.count).toBe(1);
    expect(mocks.buildSnapshot).not.toHaveBeenCalled();
  });
});
