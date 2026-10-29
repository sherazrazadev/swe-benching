#!/bin/bash
# Reference fix: escape serialized JSON wherever it is written into a script element's text, and
# recognize the end tag HTML actually accepts in JavaScript text.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
