#!/bin/bash
# Reference fix: validate the destination actually connected to, on every outbound request the
# server makes while serving a call, and refuse a non-public destination with a client error.
# Applied to the proxy route, the location it derives from an answer, the direct-download client
# and the image-import helper, while publicly routable destinations keep working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
