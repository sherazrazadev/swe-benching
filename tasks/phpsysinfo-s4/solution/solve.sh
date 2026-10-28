#!/bin/bash
# Reference fix: make the allow-list decision from the connection's peer address, honouring a
# configured trusted reverse proxy; apply the same decision to every page that reports the
# machine; and replace the standalone runtime report's own copy of the identity resolution with
# the shared one.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
