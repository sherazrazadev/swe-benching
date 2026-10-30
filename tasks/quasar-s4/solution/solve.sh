#!/usr/bin/env bash
# Reference fix: neutralise every value that is serialised into the development error
# page, in each syntactic context it is placed in, and stop the page from carrying the
# server process's environment.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
