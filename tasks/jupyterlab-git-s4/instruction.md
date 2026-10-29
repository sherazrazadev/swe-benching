# Repository values shown as markup in the Git diff views

The JupyterLab Git extension shows the differences between two revisions of a file in a tab in the
main area. Plain-text files get a side-by-side editor comparison, notebooks get a cell-level
comparison, and images get an image comparison. Each view names the revisions it is comparing, and
shows a message in place of the comparison when the content cannot be produced.

## Impact

Revision names, commit identifiers and file paths are supplied by the repository that is open. A
repository can carry a name that contains an HTML element. When a user opens a comparison for a
file whose revision or path is crafted, the element is inserted into the JupyterLab page, and a
crafted name can run script with the user's session.

One concrete trigger: a repository contains a branch whose name embeds an HTML element; the user
opens the comparison of a text file against that branch from the Git panel, and the element is
inserted into the comparison page.

## What must hold

No value that the extension obtains from the repository or the git server may be interpreted as
page markup by a comparison view. Every such value must appear as the literal characters it
contains: it must not add, change or remove elements or attributes, and it must not run as script.
This holds however the value arrives, and wherever a comparison view shows it.

## What must keep working

- Ordinary values still display: a normal comparison still shows its two sides, a merge comparison
  still shows its three sides, and a request that fails is still reported with its message text.
- Each side of the header keeps its own place in the layout.
- The failure notice keeps the structure it has today, message included.
- A message that spans several lines still shows its lines.
- Ordinary punctuation in a name is shown exactly as written.

## Constraints

- Fix the problem and its close variants, not only the example above. The example is one instance,
  not the full set.
- Keep legitimate use working exactly as it does today.
- Do not look up the upstream fix or advisory; work from this report and the code.
- Do not special-case the example.
