#!/bin/bash
# Reference fix: only redirect an authorization error to a redirect URI that is
# registered for the client identified by the request, in every flow that can
# raise one.
set -euo pipefail
cd /workspace
patch -p1 < "$(dirname "$0")/fix.patch"
