#!/bin/bash
# Reference fix: the published middleware restoration, the load-triggered
# state changes converted to token-bearing unsafe requests, and the coupled
# exemptions the product needs (identity-provider callback, key clients).
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
