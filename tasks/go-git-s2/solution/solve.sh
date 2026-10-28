#!/bin/bash
# Reference solution: apply the fix to the restored (pinned + task additions) workspace.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
