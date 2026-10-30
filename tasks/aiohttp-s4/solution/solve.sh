#!/bin/bash
# Reference fix: an announced request body is consumed before the connection
# switches protocols, in every parser and at the layer that installs the new
# protocol reader; immediate no-body switches and ordinary traffic are kept.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
