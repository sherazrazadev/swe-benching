#!/bin/bash
# Reference fix: authorise every Contrast form endpoint against the item in whose context it is
# invoked (the item's Configure permission) and against the Jenkins administrator permission when
# no item is in context. Static agent-type and severity choices stay open, and authorised
# configurers keep receiving populated choices.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
