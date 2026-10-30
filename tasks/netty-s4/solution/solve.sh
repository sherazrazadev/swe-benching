#!/usr/bin/env bash
# Reference solution: apply the fix to the pinned + injected repository.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
