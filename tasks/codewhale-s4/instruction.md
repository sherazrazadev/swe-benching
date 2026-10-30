# Git revision handling

CodeWhale is a terminal coding agent. The model it drives can call built-in tools that inspect a repository through the installed `git` binary, and some product features hand a caller-supplied revision, or a reference to select or compare revisions, to that same binary.

Those values are currently passed through unchanged. A caller can therefore supply a value that git reads as a command-line option instead of as a revision. For example, asking the commit-inspection tool to show the revision `--output=/tmp/patch.txt` makes git write the patch it generates to that path instead of returning it, so content is written outside the repository.

## Required behaviour

No value a caller supplies that the product passes to git to select or compare revisions may ever be interpreted by git as an option. Every such value must be treated as a single revision expression. Option-shaped values must be refused with a client error before the value reaches any git process, and the request must leave the repository, the workspace and every path outside them unchanged.

Everything that works today must keep working exactly as today. Ordinary revisions and comparisons — commit hashes, `HEAD`, tags, hyphenated branch names, ancestry expressions such as `HEAD~2`, `<revision>:<path>` forms, and two-dot or three-dot ranges — must still be accepted and must still produce the same output as today. Any other value that works today must also keep working.

The example above is one illustration, not the full set of affected operations and not the full set of values that must be rejected.

## Constraints

- Fix the problem and its close variants: an option-shaped value must be handled the same way wherever the product passes it to git.
- Keep legitimate use working.
- Do not look up the upstream fix or the advisory.
- Do not special-case the example.
