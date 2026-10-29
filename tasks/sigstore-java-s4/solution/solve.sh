#!/bin/bash
# Reference fix: only use a transparency-log entry time for the certificate-validity decision
# when the log signature over that time was actually verified; otherwise require a verified
# timestamp, and refuse when neither exists. Applied to the bundle verifier, the bundle
# construction check and the detached-materials verifier.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
