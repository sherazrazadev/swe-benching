#!/bin/bash
# Reference solution: apply the reference fix to the checked-out (pinned + injected) repo.
set -euo pipefail
cd /workspace
patch -p1 --forward --no-backup-if-mismatch < /solution/fix.patch
