#!/bin/bash
# Run the pristine copies of the project's own tests for the affected area. Called by
# tests/test.sh as `agent` with cwd /workspace; $1 is the JUnit XML path to write.
set -u
cd /workspace
exec python3 -m pytest -q -p no:cacheprovider -c /dev/null --rootdir=/workspace \
  $(cat /workspace/.htests/functional/project/passing.txt) \
  --junitxml="$1"
