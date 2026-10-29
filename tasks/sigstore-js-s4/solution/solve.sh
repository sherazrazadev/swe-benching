#!/bin/bash
# Reference fix: a stored credential is selected only for the registry it was
# stored for. The comparison canonicalizes both sides (scheme, path and the
# Docker Hub aliases) and uses the same identity at the network boundary, so a
# registry name that merely contains another does not receive its credential.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
