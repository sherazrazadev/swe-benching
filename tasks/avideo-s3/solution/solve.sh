#!/bin/bash
# Reference fix: authenticate every payment notification before it can credit a wallet, credit
# only the account and amount the gateway reports, and close the integration's other routes into
# the same wallet sink. Genuine signed notifications and the legacy record-driven flows keep
# working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
