#!/bin/bash
# Reference fix: canonicalise every locale module path before it is used, on every
# loading route (the published change plus the sibling loading paths in this copy).
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
