#!/bin/bash
# Reference fix: contain every client-supplied playlist identifier and name inside the playlist
# storage area, and decide playlist access from the stored playlist.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
