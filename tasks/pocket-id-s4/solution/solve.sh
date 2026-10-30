#!/usr/bin/env bash
# Apply the reference fix to the restored workspace.
set -euo pipefail
cd /workspace
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="$HERE/fix.patch"
[ -f "$PATCH_FILE" ] || PATCH_FILE=/solution/fix.patch
git apply --whitespace=nowarn "$PATCH_FILE" 2>/dev/null \
  || patch -p1 --batch --forward < "$PATCH_FILE"
