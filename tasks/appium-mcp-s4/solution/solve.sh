#!/bin/bash
# Reference fix: encode every page-derived value for the context it is placed in and
# remove page-derived values from JavaScript-string contexts.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
