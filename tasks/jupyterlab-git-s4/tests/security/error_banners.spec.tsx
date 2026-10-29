import 'jest';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { PlainTextDiff } from '../../src/components/diff/PlainTextDiff';
import { NotebookDiff } from '../../src/components/diff/NotebookDiff';
import { createImageDiff } from '../../src/components/diff/ImageDiff';
import { MARKUP, diffModel, dispose, flush, textOf } from '../support/harness';

describe('diff failure banner', () => {
  it('shows a plain-text diff failure message as text', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({
        challengerContent: () =>
          Promise.reject(new Error(`could not read ${MARKUP}`))
      })
    });
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(MARKUP);

    dispose(widget);
  });

  it('shows a failure message that is not an Error object as text', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({
        challengerContent: () => Promise.reject(`bad revision ${MARKUP}`)
      })
    });
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(MARKUP);

    dispose(widget);
  });

  it('shows a notebook diff failure message as text', async () => {
    const widget = new NotebookDiff(
      diffModel({
        filename: 'to/File.ipynb',
        challengerContent: () =>
          Promise.reject(new Error(`could not read ${MARKUP}`))
      }),
      new RenderMimeRegistry()
    );
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(MARKUP);

    dispose(widget);
  });

  it('shows an image diff failure message as text', async () => {
    const widget = await createImageDiff({
      model: diffModel({
        filename: 'to/File.png',
        challengerContent: () =>
          Promise.reject(new Error(`could not read ${MARKUP}`))
      })
    });
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(MARKUP);

    dispose(widget);
  });
});
