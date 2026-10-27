#!/bin/bash
# Reference fix: resolve the client identity once (from the peer as rewritten by the
# configured trusted-proxy middleware) for throttling and every audit entry, keep the
# pre-middleware peer for the local-only gate, never exempt a request whose peer is
# unknown, and reject an invalid trusted-proxy count at start-up.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
