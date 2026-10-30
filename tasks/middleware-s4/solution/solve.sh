#!/bin/bash
# Reference solution: apply the fix to the checked-out (pinned + injected) repo.
set -euo pipefail
cd /workspace
FIX="$(dirname "$0")/fix.patch"
[ -f "$FIX" ] || FIX=/solution/fix.patch
patch -p1 < "$FIX"
