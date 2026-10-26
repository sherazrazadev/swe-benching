#!/bin/bash
# Reference fix: one shared prototype-name predicate applied at every operation that turns caller
# input into a property write or delete (the nested write, the flat-object conversion in both
# branches, the injected flat-map expansion, the injected combine, and the injected path
# deletion), scoped so that a final field name that is ordinary data keeps being stored.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
