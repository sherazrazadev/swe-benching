#!/bin/bash
# Reference fix: the upstream fix (e0f67bdf, source files only) plus the same path-segment
# protection at every other emitter that puts a spec-supplied name into an output path, and at
# the two companion writers added in this tree.
set -euo pipefail
cd /workspace
SOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
patch -p1 < "${SOL_DIR}/fix.patch"
