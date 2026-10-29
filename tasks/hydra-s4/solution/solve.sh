#!/bin/bash
# Reference fix: the instantiation call authorizes the callable that is actually
# produced, on both the default policy and under an allowlist, for every shape of
# value the dotpath helpers accept, and refuses to bind a selection into a
# deferred value before that decision is made.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
