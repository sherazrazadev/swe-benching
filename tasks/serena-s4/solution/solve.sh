#!/bin/bash
# Reference fix: decide every dashboard request from the authority it was addressed to, matching
# the whole name against the machine's loopback names and ignoring the port, and install that
# decision where each dashboard HTTP application is created so all serving entry points inherit it.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
