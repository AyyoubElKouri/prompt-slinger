import type { Prompt } from '../../shared/types/prompt';

export function filterPrompts(prompts: Prompt[], query: string): Prompt[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return prompts;
  return prompts.filter(
    (prompt) =>
      prompt.name.toLowerCase().includes(needle) ||
      prompt.fileName.toLowerCase().includes(needle),
  );
}

export function sortPrompts(prompts: Prompt[]): Prompt[] {
  return [...prompts].sort(
    (a, b) => a.name.localeCompare(b.name) || a.fileName.localeCompare(b.fileName),
  );
}
