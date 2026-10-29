#!/bin/bash
# Reference fix: read every policy-approved remote resource without following redirects,
# fetching image bytes directly for the dimension reader, and keep no-policy behaviour.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
