#!/bin/bash
# Reference fix: one ownership rule wherever a client-supplied session identifier is
# resolved to a live session (handshake restore, sticky-cookie fallback restore, the
# feedback request that looks a session up, and the thread-resume request that rebinds).
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
