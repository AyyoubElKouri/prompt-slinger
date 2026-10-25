import { describe, expect, it } from 'vitest';
import type { Prompt } from '../../shared/types/prompt';
import { filterPrompts, sortPrompts } from './prompts.filter';

function prompt(name: string, fileName: string): Prompt {
  return {
    id: fileName,
    name,
    iconName: 'file-text',
    body: 'body',
    fileName,
    relativePath: fileName,
  };
}

const prompts = [
  prompt('Weekly review', 'weekly-review.md'),
  prompt('Code review', 'code-review.md'),
  prompt('Translate', 'translate-tone.md'),
];

describe('filterPrompts', () => {
  it('returns everything for an empty query', () => {
    expect(filterPrompts(prompts, '   ')).toEqual(prompts);
  });

  it('matches the display name case-insensitively', () => {
    expect(filterPrompts(prompts, 'WEEKLY').map((p) => p.name)).toEqual(['Weekly review']);
  });

  it('matches the filename case-insensitively', () => {
    expect(filterPrompts(prompts, 'tone').map((p) => p.name)).toEqual(['Translate']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterPrompts(prompts, 'zzz')).toEqual([]);
  });
});

describe('sortPrompts', () => {
  it('sorts by name and does not mutate the input', () => {
    const input = [prompts[0], prompts[1]];
    expect(sortPrompts(input).map((p) => p.name)).toEqual(['Code review', 'Weekly review']);
    expect(input.map((p) => p.name)).toEqual(['Weekly review', 'Code review']);
  });
});
