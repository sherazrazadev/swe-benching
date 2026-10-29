#!/bin/bash
# Reference solution: apply the fix to the checked-out (pinned + injected) repo.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
