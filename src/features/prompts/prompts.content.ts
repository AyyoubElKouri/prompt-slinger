import { browser } from 'wxt/browser';
import { INJECT_MESSAGE, type InjectResponse } from '../../shared/types/injection';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url']);
const EDITABLE_SELECTOR = 'textarea, input, [contenteditable="true"], [role="textbox"]';

export function buildInsertion(currentText: string, body: string): string {
  const leadingNewline = currentText.length > 0 && !currentText.endsWith('\n') ? '\n' : '';
  return `${leadingNewline}${body}\n---\n`;
}

export function composeInjection(currentText: string, body: string): string {
  return currentText + buildInsertion(currentText, body);
}

export function isEditableElement(element: Element | null): element is HTMLElement {
  if (!element || !(element instanceof HTMLElement)) return false;

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (element instanceof HTMLInputElement) {
    return (
      TEXT_INPUT_TYPES.has((element.type || 'text').toLowerCase()) &&
      !element.disabled &&
      !element.readOnly
    );
  }

  return element.isContentEditable || element.getAttribute('contenteditable') === 'true';
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;

  const view = element.ownerDocument.defaultView;
  if (!view) return true;

  const style = view.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  return (
    rect.bottom > 0 &&
    rect.top < view.innerHeight &&
    rect.right > 0 &&
    rect.left < view.innerWidth
  );
}

function scoreCandidate(
  element: HTMLElement,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const rect = element.getBoundingClientRect();
  const area = Math.min(rect.width * rect.height, 100_000) / 100_000;
  const bottomDistance = Math.abs(viewportHeight - rect.bottom) / Math.max(viewportHeight, 1);
  const centerDistance =
    Math.abs(rect.left + rect.width / 2 - viewportWidth / 2) / Math.max(viewportWidth, 1);
  return area * 2 - bottomDistance - centerDistance * 0.5;
}

export function findTarget(
  doc: Document,
  lastFocused: HTMLElement | null,
): HTMLElement | null {
  if (
    lastFocused &&
    lastFocused.isConnected &&
    isEditableElement(lastFocused) &&
    isVisibleElement(lastFocused)
  ) {
    return lastFocused;
  }

  const candidates = Array.from(doc.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)).filter(
    (element) => isEditableElement(element) && isVisibleElement(element),
  );

  if (candidates.length === 0) return null;

  const view = doc.defaultView;
  const viewportWidth = view?.innerWidth ?? 0;
  const viewportHeight = view?.innerHeight ?? 0;
  return (
    candidates.sort(
      (a, b) =>
        scoreCandidate(b, viewportWidth, viewportHeight) -
        scoreCandidate(a, viewportWidth, viewportHeight),
    )[0] ?? null
  );
}

function dispatchInput(element: HTMLElement, data: string): void {
  const InputEventCtor = element.ownerDocument.defaultView?.InputEvent;
  const event = InputEventCtor
    ? new InputEventCtor('input', { bubbles: true, inputType: 'insertText', data })
    : new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

function insertIntoTextField(
  element: HTMLTextAreaElement | HTMLInputElement,
  body: string,
): boolean {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  const currentText = element.value;
  const insertion = buildInsertion(currentText, body);
  const nextText = currentText + insertion;

  setter?.call(element, nextText);
  dispatchInput(element, insertion);
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.setSelectionRange(nextText.length, nextText.length);
  return element.value === nextText;
}

function insertIntoContentEditable(element: HTMLElement, body: string): boolean {
  element.focus();

  const selection = element.ownerDocument.defaultView?.getSelection();
  if (selection) {
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const before = element.textContent ?? '';
  const insertion = buildInsertion(before, body);
  let inserted = false;

  if (typeof element.ownerDocument.execCommand === 'function') {
    try {
      inserted = element.ownerDocument.execCommand('insertText', false, insertion);
    } catch {
      inserted = false;
    }
  }

  if (!inserted) {
    element.appendChild(element.ownerDocument.createTextNode(insertion));
    const InputEventCtor = element.ownerDocument.defaultView?.InputEvent;
    const beforeInput = InputEventCtor
      ? new InputEventCtor('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: insertion,
        })
      : new Event('beforeinput', { bubbles: true, cancelable: true });
    element.dispatchEvent(beforeInput);
    dispatchInput(element, insertion);
  }

  return (element.textContent ?? '').length > before.length;
}

export function insertIntoField(target: HTMLElement, body: string): boolean {
  target.focus();

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
    return insertIntoTextField(target, body);
  }

  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') {
    return insertIntoContentEditable(target, body);
  }

  return false;
}

export function flashElement(target: HTMLElement): void {
  const previousOutline = target.style.outline;
  const previousOffset = target.style.outlineOffset;
  target.style.outline = '2px solid #C9B77B';
  target.style.outlineOffset = '2px';
  setTimeout(() => {
    target.style.outline = previousOutline;
    target.style.outlineOffset = previousOffset;
  }, 700);
}

export function handleInjectRequest(
  doc: Document,
  lastFocused: HTMLElement | null,
  body: string,
): InjectResponse {
  const target = findTarget(doc, lastFocused);

  if (!target) {
    return { ok: false, error: 'No editable input found on this page.' };
  }

  if (!insertIntoField(target, body)) {
    return { ok: false, error: 'Could not insert the prompt on this page.' };
  }

  flashElement(target);
  return { ok: true };
}

export function startInjectionContentScript(): void {
  let lastFocused: HTMLElement | null = null;

  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && isEditableElement(target)) {
        lastFocused = target;
      }
    },
    true,
  );

  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return;
    const request = message as { type?: unknown; text?: unknown };
    if (request.type !== INJECT_MESSAGE || typeof request.text !== 'string') return;
    sendResponse(handleInjectRequest(document, lastFocused, request.text));
  });
}
