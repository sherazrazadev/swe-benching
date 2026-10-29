#!/bin/bash
# Reference fix: bind every partial-pipeline resume to the session that started the flow,
# record the out-of-band completion allowance on the stored flow, keep the emailed validation
# completion working, and apply the same decision in the resume paths that bypass the shared
# utility.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
