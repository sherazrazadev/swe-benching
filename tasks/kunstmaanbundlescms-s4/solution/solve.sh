#!/bin/bash
# Reference solution: normalise the stored extension before it is checked, broaden the set of
# server-executable extensions the stock product refuses to store, and route every other place
# that names a media file in the public uploads directory (the maintenance rename, the image
# crop copy and the PDF preview key) through the same stored-name rule.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
