#!/bin/bash
# Reference fix: give every file the SSG helper writes one output boundary. The path joiner
# collapses runs of parent segments and keeps a UNC prefix; the boundary check compares the
# normalised output directory and file path segment by segment and distinguishes relative,
# absolute, drive and UNC roots; and every writer (pages, response-chosen names, redirect pages
# and the output manifest) validates the file it is about to create before touching the filesystem.
set -euo pipefail
cd /workspace
FIX="$(dirname "$0")/fix.patch"
[ -f "$FIX" ] || FIX=/solution/fix.patch
patch -p1 < "$FIX"
