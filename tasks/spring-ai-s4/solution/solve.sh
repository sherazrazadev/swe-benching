#!/bin/bash
# Reference fix: neutralise query-syntax separators in every place the metadata filter
# reaches the generated query string, in the shared converter and in each integration's
# own path, while keeping ordinary escaping and shapes unchanged.
set -euo pipefail
cd /workspace
FIX="$(dirname "$0")/fix.patch"
[ -f "$FIX" ] || FIX=/solution/fix.patch
patch -p1 < "$FIX"
