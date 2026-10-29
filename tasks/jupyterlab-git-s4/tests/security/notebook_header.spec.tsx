import 'jest';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { NotebookDiff } from '../../src/components/diff/NotebookDiff';
import { requestAPI } from '../../src/git';
import { MARKUP, diffModel, dispose, flush, textOf } from '../support/harness';
import * as diffResponse from '../support/nbDiffResponse.json';

jest.mock('../../src/git');

function notebookModel(challengerLabel: string) {
  return diffModel({
    challengerLabel,
    filename: 'to/File.ipynb'
  });
}

describe('notebook diff header', () => {
  it('shows a revision label that contains markup as text', async () => {
    (requestAPI as jest.Mock).mockResolvedValueOnce(diffResponse);
    const widget = new NotebookDiff(
      notebookModel(MARKUP),
      new RenderMimeRegistry()
    );
    await widget.ready;
    await flush();

    const banner = widget.node.querySelector('.jp-git-diff-banner');
    expect(banner).toBeTruthy();
    expect(banner!.querySelector('img')).toBeNull();
    expect(textOf(banner)).toContain(MARKUP);

    dispose(widget);
  });
});
