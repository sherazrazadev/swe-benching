#!/bin/bash
# Reference solution: the published source fixes plus the same owner-only treatment on the
# shared credentials writer and the injected database-token writer.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
