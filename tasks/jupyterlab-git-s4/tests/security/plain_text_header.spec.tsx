import 'jest';
import { PlainTextDiff } from '../../src/components/diff/PlainTextDiff';
import { MARKUP, diffModel, dispose, textOf } from '../support/harness';

describe('plain-text diff header', () => {
  it('shows a revision label that contains markup as text', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({ challengerLabel: MARKUP })
    });
    await widget.ready;

    const banner = widget.node.querySelector('.jp-git-diff-banner');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(MARKUP);

    dispose(widget);
  });

  it('shows a merge header with a markup label as text', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({
        challengerLabel: MARKUP,
        baseLabel: 'Common Ancestor'
      })
    });
    await widget.ready;

    const banner = widget.node.querySelector('.jp-git-merge-banner');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(MARKUP);
    expect(textOf(banner)).toContain('Common Ancestor');

    dispose(widget);
  });

  it('shows a composed relocation label as text', async () => {
    const label = `docs/${MARKUP}.md (abc1234)`;
    const widget = new PlainTextDiff({
      model: diffModel({ challengerLabel: label })
    });
    await widget.ready;

    const banner = widget.node.querySelector('.jp-git-diff-banner');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(label);

    dispose(widget);
  });
});
