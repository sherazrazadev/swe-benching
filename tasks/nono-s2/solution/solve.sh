#!/bin/bash
# Reference fix: verify an installed pack against its install record on every
# surface that uses pack content, and resolve the pack where it actually lives.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
