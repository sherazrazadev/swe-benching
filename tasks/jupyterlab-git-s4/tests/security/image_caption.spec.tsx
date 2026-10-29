import 'jest';
import { createImageDiff } from '../../src/components/diff/ImageDiff';
import { MARKUP, diffModel, dispose, flush, textOf } from '../support/harness';

describe('image diff file caption', () => {
  it('shows a file path that contains markup as text', async () => {
    const filename = `${MARKUP}.png`;
    const widget = await createImageDiff({
      model: diffModel({
        filename,
        challengerLabel: 'WORKING'
      })
    });
    await flush();

    const caption = widget.node.querySelector('.jp-git-image-diff-caption');
    expect(caption).toBeTruthy();
    expect(caption!.querySelector('img')).toBeNull();
    expect(textOf(caption)).toContain(filename);

    dispose(widget);
  });
});
