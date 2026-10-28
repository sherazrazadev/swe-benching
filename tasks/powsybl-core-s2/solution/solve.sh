#!/usr/bin/env bash
# Reference fix: every value handed to a local command execution backend is passed as literal
# data, in every backend and in every position of the command line, while a search-path setting
# keeps extending the inherited value.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
