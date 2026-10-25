import { parse as parseYaml } from 'yaml';
import type { Prompt } from '../../shared/types/prompt';

const FRONTMATTER = /^(?:\uFEFF)?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

export function parsePrompt(raw: string, fileName: string, relativePath: string): Prompt {
  let data: Record<string, unknown> | null = null;
  let body = raw;
  const match = FRONTMATTER.exec(raw);

  if (match) {
    try {
      const parsed = parseYaml(match[1] ?? '') as unknown;
      data =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      body = raw.slice(match[0].length);
    } catch {
      data = null;
    }
  }

  const rawName = data?.name;
  const rawTitle = data?.title;
  const rawIcon = data?.['icon-name'];
  const fallbackName = fileName.replace(/\.md$/i, '');
  const readText = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const name = readText(rawName) ?? readText(rawTitle) ?? fallbackName;
  const iconName = readText(rawIcon) ?? 'file-text';

  return {
    id: relativePath,
    name,
    iconName,
    body: body.trim(),
    fileName,
    relativePath,
  };
}
