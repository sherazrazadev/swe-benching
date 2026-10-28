#!/bin/bash
# Reference fix: record the canonical location of every shared folder, resolve every entry
# before deciding whether it is inside one of them, and apply that decision to the file
# inventory, the individual-file stream, the single-file convenience branch, the archive
# writer, the per-folder archive and the inventory refreshed while browsing. Ordinary files
# next to an unservable entry keep working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
