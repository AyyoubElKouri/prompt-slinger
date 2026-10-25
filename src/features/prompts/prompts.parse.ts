import { parse as parseYaml } from 'yaml';
import type { Prompt } from '../../shared/types/prompt';

const FRONTMATTER = /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parsePrompt(raw: string, fileName: string, relativePath: string): Prompt {
  let data: Record<string, unknown> | null = null;
  let body = raw;
  const match = FRONTMATTER.exec(raw);

  if (match) {
    try {
      const parsed = parseYaml(match[1] ?? '') as unknown;
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
