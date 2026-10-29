import { DiffModel } from '../../src/components/diff/model';

/**
 * A harmless marker: if a value is parsed as HTML, it shows up as an element
 * with this attribute instead of as text. Nothing is loaded or executed.
 */
export const MARKUP = '<img src=x onerror="window.__xss=1">';

/**
 * A ref name that is legal in git and closes an attribute and opens another.
 */
export const ATTR_MARKUP = 'x"onmouseover="window.__xss=1';

export interface IModelOptions {
  referenceLabel?: string;
  challengerLabel?: string;
  baseLabel?: string;
  filename?: string;
  referenceContent?: () => Promise<string>;
  challengerContent?: () => Promise<string>;
  baseContent?: () => Promise<string>;
}

/**
 * Build a diff model with sensible defaults, overriding only what a test needs.
 */
export function diffModel(options: IModelOptions = {}): DiffModel {
  const {
    referenceLabel = '83baee',
    challengerLabel = 'WORKING',
    baseLabel,
    filename = 'to/File.py',
    referenceContent = () => Promise.resolve('reference'),
    challengerContent = () => Promise.resolve('challenger'),
    baseContent = () => Promise.resolve('base')
  } = options;

  return new DiffModel({
    challenger: {
      content: challengerContent,
      label: challengerLabel,
      source: 'HEAD'
    },
    reference: {
      content: referenceContent,
      label: referenceLabel,
      source: '83baee'
    },
    base:
      baseLabel === undefined
        ? undefined
        : { content: baseContent, label: baseLabel, source: 'BASE' },
    filename,
    repositoryPath: 'path'
  });
}

/**
 * The text a node shows.
 */
export function textOf(node: Element | null): string {
  return node ? node.textContent ?? '' : '';
}

/**
 * Let pending promise callbacks and timers run.
 */
export async function flush(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

/**
 * Dispose a widget without assuming a particular class.
 */
export function dispose(widget: unknown): void {
  const disposable = widget as { dispose?: () => void };
  if (disposable && typeof disposable.dispose === 'function') {
    disposable.dispose();
  }
}
