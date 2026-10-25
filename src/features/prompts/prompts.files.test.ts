import { describe, expect, it } from 'vitest';
import { MAX_DEPTH, MAX_PROMPTS, ensureReadPermission, scanDirectory } from './prompts.files';

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

  it('caps recursion at the maximum depth', async () => {
    let node = directory('leaf', [file('too-deep.md', 'Deep')]);
    for (let level = 0; level <= MAX_DEPTH; level += 1) {
      node = directory(`level-${level}`, [node]);
    }
    const result = await scanDirectory(node);
    expect(result.prompts).toHaveLength(0);
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
