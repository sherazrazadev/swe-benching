#!/bin/bash
# Reference solution: replace every permissive base-type rule used for cursor decoding
# with an explicit allow-list of the container and value types the feature uses.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
