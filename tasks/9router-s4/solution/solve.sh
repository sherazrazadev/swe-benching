#!/bin/bash
# Reference fix: every request passes through the access decision, host-level operations
# require the machine-local CLI token rather than a caller-supplied origin claim, every
# non-public API path is denied by default, and the explicit pre-login and local-model
# exceptions keep working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
