#!/bin/bash
# Reference fix: every module name the unpackers and the command line derive from
# an untrusted input is reduced to ordinary relative components, and every write
# is checked against the canonical output directory (including existing links).
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
