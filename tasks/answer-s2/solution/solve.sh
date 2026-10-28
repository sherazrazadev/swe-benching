#!/bin/bash
# Reference solution: apply the fix to the checked-out (pinned + injected) repository.
set -euo pipefail
cd /workspace
patch -p1 --forward --no-backup-if-mismatch < /solution/fix.patch
