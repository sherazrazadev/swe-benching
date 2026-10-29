#!/bin/bash
# Reference fix: withhold the connection settings from callers without the view
# permission on every response path, and mask password-like values in the settings
# even for callers who may see them.
set -euo pipefail
cd /workspace
patch -p1 < "$(dirname "$0")/fix.patch"
