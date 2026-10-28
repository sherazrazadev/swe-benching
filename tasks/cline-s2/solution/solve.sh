#!/bin/bash
# Reference fix: the published origin/host gate for every request on the dashboard listener, the
# public-address port normalisation the gate depends on, the public page-asset exemption, and the
# same origin rule on the desktop application's browser bridge. The injected sibling endpoints sit
# behind the same request gate.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
