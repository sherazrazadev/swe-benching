#!/bin/bash
# Reference fix: the upstream parser change, the tokenizer rule that hid an empty quoted
# local part removed, a ready address value recovered before it is normalised, and the SMTP
# client's quote-stripping rule removed.
set -euo pipefail
cd /workspace
SOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
git apply --verbose "${SOL_DIR}/fix.patch" || patch -p1 < "${SOL_DIR}/fix.patch"
