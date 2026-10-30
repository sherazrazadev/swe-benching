#!/bin/bash
# Reference fix: reduce every package-supplied file name to one contained path
# component before it is joined onto a directory, at every save and reuse site.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
