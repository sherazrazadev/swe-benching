#!/bin/bash
# Reference fix: the published fix (ab607a29, source changes only) plus the same encoding in the
# pattern-mode URL helpers this copy of the tree ships (the legacy pattern builder, the
# pattern-mode signed URL builder and the declarative pattern redirect). Every parameter value is
# percent-encoded per segment; wildcard lists are encoded element by element before the join.
set -euo pipefail
cd /workspace
SOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
git apply --verbose "${SOL_DIR}/fix.patch" || patch -p1 < "${SOL_DIR}/fix.patch"
