#!/bin/bash
# Reference fix: the published change (own-prototype-free chart maps; own-key, escaped table
# rendering) plus the same protection in the independent header renderer and pivot producer.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
