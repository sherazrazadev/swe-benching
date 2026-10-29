#!/bin/bash
# Reference fix: decide the local-auth opt-out from the server's own bind
# address, require the telephony token, and protect every agent route.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
