#!/bin/bash
# Reference fix: validate every sound a client stores (extension, decoded content and size)
# before it can reach the filesystem, on every path that stores one.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
