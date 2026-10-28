#!/bin/bash
# Reference oracle: apply the source fix to the checked-out repository.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
