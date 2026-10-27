#!/bin/bash
# Reference solution: apply the fix to the checked-out project tree.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
