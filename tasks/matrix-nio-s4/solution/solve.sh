#!/bin/bash
# Reference solution: migrate every encryption operation and stored state to the maintained
# backend, keep state written by earlier releases loading, and port the sibling key-upload and
# trust-store routes.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
