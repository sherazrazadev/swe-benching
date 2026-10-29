#!/bin/bash
# Reference fix: render every stored template in a sandboxed Jinja engine (prompt renderer,
# resource-body renderer, import-preview renderer) and replace the unfiltered Python format
# fallback with one that only accepts plain {name} fields.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
