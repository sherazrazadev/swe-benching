#!/usr/bin/env bash
set -euo pipefail
cd /workspace
patch -p1 -N --batch < /solution/fix.patch
