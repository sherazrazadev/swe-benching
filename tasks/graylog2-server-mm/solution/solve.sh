#!/bin/bash
# Reference fix: require ownership of the entity whose sharing an update request changes,
# for every kind of shareable object, before applying the sharing instruction.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
