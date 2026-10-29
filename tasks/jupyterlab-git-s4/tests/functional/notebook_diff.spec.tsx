import 'jest';
import { Toolbar } from '@jupyterlab/apputils';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import {
  NotebookDiff,
  createNotebookDiff
} from '../../src/components/diff/NotebookDiff';
import { requestAPI } from '../../src/git';
import { diffModel, dispose, flush, textOf } from '../support/harness';
import * as diffResponse from '../support/nbDiffResponse.json';

jest.mock('../../src/git');

describe('notebook diff display', () => {
  it('keeps one place per revision in the header', async () => {
    (requestAPI as jest.Mock).mockResolvedValueOnce(diffResponse);
    const widget = new NotebookDiff(
      diffModel({
        referenceLabel: '83baee',
        challengerLabel: 'WORKING',
        filename: 'to/File.ipynb'
      }),
      new RenderMimeRegistry()
    );
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-banner');
    expect(banner).toBeTruthy();
    expect(banner!.children).toHaveLength(2);
    expect(textOf(banner)).toContain('83baee');
    expect(textOf(banner)).toContain('WORKING');

    dispose(widget);
  });

  it('shows both revisions in the toolbar context', async () => {
    (requestAPI as jest.Mock).mockResolvedValueOnce(diffResponse);
    const toolbar = new Toolbar();
    const widget = await createNotebookDiff({
      model: diffModel({
        referenceLabel: '83baee',
        challengerLabel: 'WORKING',
        filename: 'to/File.ipynb'
      }),
      renderMime: new RenderMimeRegistry(),
      toolbar
    });
    await flush();

    const context = toolbar.node.querySelector('.jp-git-diff-context');
    expect(context).toBeTruthy();
    expect(textOf(context)).toContain('83baee');
    expect(textOf(context)).toContain('WORKING');

    dispose(widget);
  });

  it('still reports a load failure with its message', async () => {
    const widget = new NotebookDiff(
      diffModel({
        filename: 'to/File.ipynb',
        challengerContent: () => Promise.reject(new Error('bad notebook diff'))
      }),
      new RenderMimeRegistry()
    );
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-error');
    expect(banner).toBeTruthy();
    expect(textOf(banner)).toContain('bad notebook diff');

    dispose(widget);
  });
});
