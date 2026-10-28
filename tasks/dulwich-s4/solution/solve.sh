#!/bin/bash
# Reference fix: build the filter-branch temporary index in memory, and refuse to write through a
# symlinked parent everywhere recorded content is placed into a directory; remove stale symlinks
# where a tree needs a directory before whole-tree materialisation.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
