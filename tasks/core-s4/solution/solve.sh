#!/usr/bin/env bash
# Reference fix: validate every client-supplied reference against the resource type declared for
# the place it is used, accepting subtypes and refusing everything else.
set -euo pipefail

cd /workspace
patch -p1 --batch --forward < /solution/fix.patch
