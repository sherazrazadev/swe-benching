#!/bin/bash
# Reference fix: gate every built-in test-support surface behind the operator opt-in, at the
# shared assembly point, so both the server factory and the exported configuration API honour it.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
