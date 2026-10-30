#!/bin/bash
# Reference fix: every value a client supplies is stripped of terminal escape and
# control sequences before it can reach the console or the server log, the
# product's own diagnostic formatting is untouched, and a refused request is
# answered with a client error instead of an unhandled server error.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
