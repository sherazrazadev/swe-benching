#!/bin/bash
# Reference fix: reject any location value that carries a parent-directory segment before it is
# used to create, move or rewrite anything, while keeping absolute and nested targets working.
set -euo pipefail
FIX="$(cd "$(dirname "$0")" && pwd)/fix.patch"
patch -p1 -d /workspace < "$FIX"
