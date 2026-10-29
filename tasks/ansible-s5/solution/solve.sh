#!/bin/bash
# Reference fix: end option parsing before every requirement-supplied operand on each command
# that hands one to the version-control client, and keep the internally added certificate
# setting a real option. Legitimate installs, pinned revisions and the subdirectory path keep
# working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
