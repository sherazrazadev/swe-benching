#!/bin/bash
# Apply the reference fix to the restored project.
set -euo pipefail
cd /workspace
patch -p1 < "$(dirname "$0")/fix.patch"
