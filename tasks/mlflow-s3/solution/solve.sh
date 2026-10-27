#!/bin/bash
# Reference fix: refuse a supplied or stored configuration whose destination is not
# publicly routable, at supply and again before a connection is opened, while keeping
# the shipped provider default working.
set -euo pipefail
cd /workspace
patch -p1 --forward --no-backup-if-mismatch < /solution/fix.patch
