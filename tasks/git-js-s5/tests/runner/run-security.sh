#!/bin/sh
# Hidden security group. Writes the JUnit XML for the group into the agent-writable
# directory passed as $1; the caller copies it into the root-locked log tree.
set -u
OUT="$1"
ROOT="${RUN_ROOT:-/opt/git-js}"
PKG="$ROOT/simple-git"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
FAKE_GIT_PATH="$HERE/bin/fake-git"
cd "$PKG" || exit 1
HIDDEN_ROOT="$PKG" \
HIDDEN_GLOB='.htests/security/**/*.spec.mts' \
HIDDEN_CACHE_DIR=/tmp/vitest-cache-security \
JUNIT_OUT="$OUT/security.xml" \
FAKE_GIT="$FAKE_GIT_PATH" \
./node_modules/.bin/vitest run --config .htests/support/vitest.hidden.config.mts || true
