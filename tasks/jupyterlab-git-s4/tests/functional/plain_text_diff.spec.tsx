import 'jest';
import { PlainTextDiff } from '../../src/components/diff/PlainTextDiff';
import { diffModel, dispose, flush, textOf } from '../support/harness';

describe('plain-text diff display', () => {
  it('keeps one place per revision in the header', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({ referenceLabel: '83baee', challengerLabel: 'WORKING' })
    });
    await widget.ready;

    const banner = widget.node.querySelector('.jp-git-diff-banner');
    expect(banner).toBeTruthy();
    expect(banner!.children).toHaveLength(2);
    expect(textOf(banner)).toContain('83baee');
    expect(textOf(banner)).toContain('WORKING');

    dispose(widget);
  });

  it('keeps one place per revision in a merge header', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({
        referenceLabel: '83baee',
        challengerLabel: 'WORKING',
        baseLabel: 'Common Ancestor'
      })
    });
    await widget.ready;

    const banner = widget.node.querySelector('.jp-git-merge-banner');
    expect(banner).toBeTruthy();
    expect(banner!.children).toHaveLength(3);
    expect(textOf(banner)).toContain('83baee');
    expect(textOf(banner)).toContain('Common Ancestor');
    expect(textOf(banner)).toContain('WORKING');

    dispose(widget);
  });

  it('shows an ordinary label with symbols as written', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({ challengerLabel: 'feature/rock&roll' })
    });
    await widget.ready;

    const banner = widget.node.querySelector('.jp-git-diff-banner');
    expect(textOf(banner)).toContain('feature/rock&roll');

    dispose(widget);
  });

  it('still reports a load failure with its message', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({
        challengerContent: () => Promise.reject(new Error('cannot read object'))
      })
    });
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    expect(textOf(banner)).toContain('cannot read object');

    dispose(widget);
  });

  it('keeps the lines of a multi-line failure message', async () => {
    const widget = new PlainTextDiff({
      model: diffModel({
        challengerContent: () =>
          Promise.reject(new Error('first line\nsecond line'))
      })
    });
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    const message = banner!.querySelector('.jp-git-diff-error-message');
    expect(message).toBeTruthy();
    expect(textOf(message)).toContain('first line');
    expect(textOf(message)).toContain('second line');

    const keepsLines =
      message!.querySelector('br') !== null ||
      textOf(message).includes('\n') ||
      Array.from(message!.children).some(element =>
        ['DIV', 'P', 'LI'].includes(element.tagName)
      );
    expect(keepsLines).toBe(true);

    dispose(widget);
  });
});
