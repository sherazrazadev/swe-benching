#!/bin/bash
# Reference fix: validate the locale shape at the public selection API, at every dictionary
# read path, and before the calendar localization registers a path; coerce the developer
# display scale; escape caller-supplied attribute values in the generated markup helpers.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
