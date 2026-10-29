#!/usr/bin/env bash
# Reference solution: stop prototype-naming keys from becoming object state in the shared object
# helpers, the query converter, the response projection and the memory adapter's record copy,
# while keeping every other merge, copy, projection and query behaviour unchanged.
set -euo pipefail

cd /workspace
SOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
patch -p1 --batch --forward < "${SOL_DIR}/fix.patch"
