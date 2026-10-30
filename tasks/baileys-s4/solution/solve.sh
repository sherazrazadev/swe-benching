#!/bin/bash
# Reference fix: refuse control messages from a non-own origin at the inbound dispatcher (on the
# normalised content, including the account-setting type) and gate the socket layer's history-sync
# bookkeeping, eager app-state key write and sync trigger on the own-device origin.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
