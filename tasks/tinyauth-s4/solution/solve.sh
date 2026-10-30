#!/bin/bash
# Reference fix: select a per-app rule by a canonicalised host address at every
# source, including the index built ahead of the request.
set -euo pipefail
cd /workspace
patch -p1 --batch --forward < /solution/fix.patch
