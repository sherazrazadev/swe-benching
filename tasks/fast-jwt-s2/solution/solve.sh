#!/bin/bash
# Reference fix: the published change plus the key-classification sites the report does not
# lead to -- the signing detector, the memo that replays a decision made for a different
# operation, the key-ring entry classification and the certificate-chain fallback.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
