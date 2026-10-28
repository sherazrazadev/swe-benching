#!/bin/bash
# Reference fix: authorization over an account's authentication settings (and over
# destroying an account) is decided per target account on every user-update path, while
# legitimate profile edits and values that disable a setting keep working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
