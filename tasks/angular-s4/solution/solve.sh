#!/bin/bash
# Reference fix: apply the source changes to the restored workspace.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
