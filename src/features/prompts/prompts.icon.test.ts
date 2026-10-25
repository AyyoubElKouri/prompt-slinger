import { FileText, icons } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { resolveIcon } from './prompts.icon';

describe('resolveIcon', () => {
  it('resolves a kebab-case Lucide name', () => {
    expect(resolveIcon('code-xml')).toBe(icons.CodeXml);
  });

  it('resolves names containing digits', () => {
    expect(resolveIcon('rotate-3d')).toBe(icons.Rotate3d);
  });

  it('falls back to file-text for unknown names', () => {
    expect(resolveIcon('not-a-real-icon')).toBe(FileText);
  });

  it('falls back for an empty name', () => {
    expect(resolveIcon('')).toBe(FileText);
  });
});
