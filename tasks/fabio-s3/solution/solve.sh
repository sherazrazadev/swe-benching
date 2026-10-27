#!/bin/bash
# Reference fix: every value the proxy adds to a forwarded request is protected from the client's
# connection annotations, on every path the proxy writes the request by, while headers the client
# asks to be treated as connection-scoped are still removed.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
