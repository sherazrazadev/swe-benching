#!/bin/bash
# Reference fix: every palette-carrying image (any mode, including lazily opened files)
# contributes its colour table in full, separately from the sampled pixel buffer.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
