#!/bin/bash
# Reference fix: every request-derived location the server resolves against the
# documentation root is contained to that root, for reads, cache writes, index
# generation, removal and preview; ordinary serving and caching are unchanged.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
