import { describe, expect, it } from 'vitest';
import { parsePrompt } from './prompts.parse';

describe('parsePrompt', () => {
  it('parses frontmatter name and icon-name and trims the body', () => {
    const raw = '---\nname: "Code Review"\nicon-name: code-xml\n---\n\nReview this.\n';
    expect(parsePrompt(raw, 'code-review.md', 'Writing/code-review.md')).toEqual({
      id: 'Writing/code-review.md',
      name: 'Code Review',
      iconName: 'code-xml',
      body: 'Review this.',
      fileName: 'code-review.md',
      relativePath: 'Writing/code-review.md',
    });
  });

  it('uses title as the name when name is missing', () => {
    const raw = '---\ntitle: Clean LLM Response\nicon-name: bot-message-square\n---\nBody';
    expect(parsePrompt(raw, 'clean-llm-answers.md', 'clean-llm-answers.md')).toMatchObject({
      name: 'Clean LLM Response',
      iconName: 'bot-message-square',
      body: 'Body',
    });
  });

  it('prefers name over title when both are present', () => {
    const raw = '---\nname: Primary\ntitle: Secondary\n---\nBody';
    expect(parsePrompt(raw, 'both.md', 'both.md').name).toBe('Primary');
  });

  it('falls back to the filename and file-text when fields are missing', () => {
    const raw = '---\ndescription: nope\n---\nBody';
    const prompt = parsePrompt(raw, 'fallback.md', 'fallback.md');
    expect(prompt.name).toBe('fallback');
    expect(prompt.iconName).toBe('file-text');
    expect(prompt.body).toBe('Body');
  });

  it('treats malformed YAML as no frontmatter', () => {
    const raw = '---\nname: [unclosed\n---\nBody';
    const prompt = parsePrompt(raw, 'broken.md', 'broken.md');
    expect(prompt.name).toBe('broken');
    expect(prompt.iconName).toBe('file-text');
    expect(prompt.body).toBe(raw);
  });

  it('handles CRLF and a BOM', () => {
    const raw = '\uFEFF---\r\nname: Test\r\nicon-name: sparkles\r\n---\r\nHello';
    expect(parsePrompt(raw, 'test.md', 'test.md')).toMatchObject({
      name: 'Test',
      iconName: 'sparkles',
      body: 'Hello',
    });
  });

  it('uses the whole file when there is no frontmatter', () => {
    const raw = 'Just a prompt\nwith lines';
    expect(parsePrompt(raw, 'plain.md', 'plain.md')).toMatchObject({
      name: 'plain',
      iconName: 'file-text',
      body: raw,
    });
  });
});

describe('empty frontmatter', () => {
  it('strips an empty frontmatter block', () => {
    expect(parsePrompt('---\n---\nBody', 'empty.md', 'empty.md').body).toBe('Body');
  });

  it('strips a blank frontmatter block', () => {
    expect(parsePrompt('---\n\n---\nBody', 'blank.md', 'blank.md').body).toBe('Body');
  });

  it('strips a comment-only frontmatter block', () => {
    expect(parsePrompt('---\n# note\n---\nBody', 'comment.md', 'comment.md').body).toBe('Body');
  });
});
