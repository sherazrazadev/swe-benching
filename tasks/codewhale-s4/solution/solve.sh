#!/bin/bash
# Reference fix: every value the product hands to git as a revision, range or comparison base is
# validated (non-empty, not option-shaped, no control characters) before any git process runs:
# both published tool fields, the code-review base, the diff tool's base, every entry of the
# history listing's start-point list, and the sub-agent checkout base. Ordinary revisions,
# comparisons and isolated checkouts keep working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
