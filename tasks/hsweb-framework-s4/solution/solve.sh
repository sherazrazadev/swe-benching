#!/bin/bash
set -euo pipefail
FIX="$(cd "$(dirname "$0")" && pwd)/fix.patch"
patch -p1 -d /workspace < "$FIX"
