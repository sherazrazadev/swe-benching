import 'jest';
import { Toolbar } from '@jupyterlab/apputils';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { createNotebookDiff } from '../../src/components/diff/NotebookDiff';
import { requestAPI } from '../../src/git';
import {
  ATTR_MARKUP,
  diffModel,
  dispose,
  flush,
  textOf
} from '../support/harness';
import * as diffResponse from '../support/nbDiffResponse.json';

jest.mock('../../src/git');

describe('notebook diff context', () => {
  it('shows a revision label that breaks out of an attribute as text', async () => {
    (requestAPI as jest.Mock).mockResolvedValueOnce(diffResponse);
    const toolbar = new Toolbar();
    const widget = await createNotebookDiff({
      model: diffModel({
        referenceLabel: ATTR_MARKUP,
        challengerLabel: 'WORKING',
        filename: 'to/File.ipynb'
      }),
      renderMime: new RenderMimeRegistry(),
      toolbar
    });
    await flush();

    const context = toolbar.node.querySelector('.jp-git-diff-context');
    expect(context).toBeTruthy();
    expect(context!.querySelector('[onmouseover]')).toBeNull();
    expect(textOf(context)).toContain(ATTR_MARKUP);

    dispose(widget);
  });
});
