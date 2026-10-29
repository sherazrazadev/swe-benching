#!/bin/bash
# Reference fix: resolve the client's request target once in the policy package and use it for
# every policy rule that decides on the request URL.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
