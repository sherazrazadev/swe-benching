import 'jest';
import { createImageDiff } from '../../src/components/diff/ImageDiff';
import { diffModel, dispose, flush, textOf } from '../support/harness';

describe('image diff display', () => {
  it('shows the path of the file being compared', async () => {
    const widget = await createImageDiff({
      model: diffModel({ filename: 'img/logo.png' })
    });
    await flush();

    const caption = widget.node.querySelector('.jp-git-image-diff-caption');
    expect(caption).toBeTruthy();
    expect(textOf(caption)).toContain('img/logo.png');

    dispose(widget);
  });

  it('still reports a load failure with its message', async () => {
    const widget = await createImageDiff({
      model: diffModel({
        filename: 'img/logo.png',
        challengerContent: () => Promise.reject(new Error('bad image diff'))
      })
    });
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    expect(textOf(banner)).toContain('bad image diff');

    dispose(widget);
  });
});
