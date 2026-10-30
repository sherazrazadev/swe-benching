#!/bin/bash
# Reference fix: resolve every file an archive entry names against the extraction directory and
# refuse it unless it stays inside, for both readers that expand self-extracting P3/SureTrak
# archives and for the tar container, while the pre-existing zip expansion keeps its behaviour.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
