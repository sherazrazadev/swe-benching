#!/bin/bash
# Reference fix: apply the published guard changes plus the fixes for the other routes
# that carry a caller-supplied value into a program git runs (the destination of a section
# rename, the packed configuration environment, positional command operands and the
# command-naming filter switches).
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
