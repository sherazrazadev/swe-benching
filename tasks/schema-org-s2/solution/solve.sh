#!/bin/bash
# Reference solution: apply the source fix to the checked-out project.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
