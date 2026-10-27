#!/bin/bash
# Reference fix: apply the reference patch to the checked-out (pinned + injected) tree.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
