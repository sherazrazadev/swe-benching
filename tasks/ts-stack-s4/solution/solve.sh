#!/bin/bash
# Reference fix: reconcile every output that comes back from storage with the
# caller's request before the transaction is signed or handed back for signing.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
