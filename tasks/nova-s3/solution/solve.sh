#!/bin/bash
# Reference fix: canonicalise every image-injection path as the privileged
# service and refuse anything that resolves outside the mounted guest root.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
