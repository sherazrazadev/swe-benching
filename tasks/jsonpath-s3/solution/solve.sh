#!/bin/bash
# Reference fix: the published source changes for the evaluation flaw, plus the same safe
# interpreter wired into the browser and edge builds, the unsafe lower-level export removed,
# and the public preparation helper prevented from injecting a script the safe mode reuses.
set -euo pipefail
cd /workspace
SOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
git apply --verbose "${SOL_DIR}/fix.patch" || patch -p1 < "${SOL_DIR}/fix.patch"
