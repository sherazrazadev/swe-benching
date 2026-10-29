#!/bin/bash
# Reference fix: attribute requests to the real client only through trusted peers,
# then use that address everywhere the allowlist and the sign-in lockout decide.
set -euo pipefail
cd /workspace
patch -p1 -E < /solution/fix.patch
