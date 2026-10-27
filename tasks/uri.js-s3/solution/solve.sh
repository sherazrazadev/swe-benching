#!/bin/bash
# Reference solution: apply the fix to the checked-out (pinned) repo.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
