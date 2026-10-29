#!/bin/bash
# Reference fix: a checkpoint may provide data for the library's own rebuild logic, never the
# logic itself. The product's own instantiator is still resolved and called, so checkpoints the
# library saved restore their class, nested typed arguments and values; every checkpoint-named
# callable on the other paths is refused before it is imported or called.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
