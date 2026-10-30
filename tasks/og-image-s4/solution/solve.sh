#!/bin/bash
# Reference fix: the upstream fix (243cac22, source files only) plus the same gate and
# redirect re-validation on the two platform font handlers this copy ships that upstream does
# not have (serverless and Netlify).
set -euo pipefail
cd /workspace
SOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
git apply --verbose "${SOL_DIR}/fix.patch" || patch -p1 < "${SOL_DIR}/fix.patch"
