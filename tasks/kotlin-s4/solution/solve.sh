#!/usr/bin/env bash
# Reference fix: only the value classes kapt writes itself may be reconstructed from on-disk
# build data, on every path that reads such data back.
set -euo pipefail
cd /workspace
patch -p1 --forward --no-backup-if-mismatch < /solution/fix.patch
