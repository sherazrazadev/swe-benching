#!/bin/bash
# Reference fix: validate a repository proxy value at every boundary that uses it, and never
# build a shell command from it without that validation.
set -euo pipefail
cd /workspace
patch -p1 --batch --forward < /solution/fix.patch
