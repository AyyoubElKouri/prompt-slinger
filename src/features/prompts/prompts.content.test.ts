// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildInsertion,
  composeInjection,
  handleInjectRequest,
  isEditableElement,
} from './prompts.content';

beforeEach(() => {
  document.body.innerHTML = '';
});

function visible<T extends HTMLElement>(element: T): T {
  element.getBoundingClientRect = () =>
    ({
      width: 300,
      height: 40,
      top: 700,
      left: 100,
      right: 400,
      bottom: 740,
      x: 100,
      y: 700,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(element);
  return element;
}

describe('text composition', () => {
  it('does not add a leading newline for an empty input', () => {
    expect(composeInjection('', 'Body')).toBe('Body\n---\n');
  });

  it('adds one leading newline for non-empty text', () => {
    expect(composeInjection('Existing', 'Body')).toBe('Existing\nBody\n---\n');
  });

  it('does not duplicate a trailing newline', () => {
    expect(composeInjection('Existing\n', 'Body')).toBe('Existing\nBody\n---\n');
  });

  it('keeps the exact separator', () => {
    expect(buildInsertion('', 'Body')).toBe('Body\n---\n');
  });
});

describe('isEditableElement', () => {
  it('accepts textareas and contenteditable elements', () => {
    expect(isEditableElement(visible(document.createElement('textarea')))).toBe(true);
    const rich = visible(document.createElement('div'));
    rich.setAttribute('contenteditable', 'true');
    expect(isEditableElement(rich)).toBe(true);
  });

  it('rejects checkboxes and null', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isEditableElement(checkbox)).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });
});

describe('handleInjectRequest', () => {
  it('reports an error when there is no editable target', () => {
    expect(handleInjectRequest(document, null, 'Body')).toEqual({
      ok: false,
      error: 'No editable input found on this page.',
    });
  });

  it('appends into a textarea', () => {
    const textarea = visible(document.createElement('textarea'));
    textarea.value = 'Existing';
    expect(handleInjectRequest(document, textarea, 'Body')).toEqual({ ok: true });
    expect(textarea.value).toBe('Existing\nBody\n---\n');
  });

  it('appends into a contenteditable element without execCommand support', () => {
    const rich = visible(document.createElement('div'));
    rich.setAttribute('contenteditable', 'true');
    rich.textContent = '';
    const events: string[] = [];
    rich.addEventListener('beforeinput', () => events.push('beforeinput'));
    rich.addEventListener('input', () => events.push('input'));
    expect(handleInjectRequest(document, rich, 'Body')).toEqual({ ok: true });
    expect(rich.textContent).toBe('Body\n---\n');
    expect(events).toContain('beforeinput');
    expect(events).toContain('input');
  });
});
