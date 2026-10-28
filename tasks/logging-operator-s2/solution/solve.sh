#!/bin/bash
# Apply the reference fix to /workspace.
set -euo pipefail
cd /workspace
patch -p1 < "$(dirname "$0")/fix.patch"
