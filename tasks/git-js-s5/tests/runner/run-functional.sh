#!/bin/sh
# Functional group: the hidden legitimate-use suite plus the project's own tests for the
# affected area, restored from pristine copies staged by test.sh.
set -u
OUT="$1"
ROOT="${RUN_ROOT:-/opt/git-js}"
PKG="$ROOT/simple-git"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
FAKE_GIT_PATH="$HERE/bin/fake-git"

# 1. hidden legitimate-use suite
cd "$PKG" || exit 1
HIDDEN_ROOT="$PKG" \
HIDDEN_GLOB='.htests/functional/**/*.spec.mts' \
HIDDEN_CACHE_DIR=/tmp/vitest-cache-functional \
JUNIT_OUT="$OUT/functional.xml" \
FAKE_GIT="$FAKE_GIT_PATH" \
./node_modules/.bin/vitest run --config .htests/support/vitest.hidden.config.mts || true

# 2. the project's own argument-parser suite, from pristine copies. The copy omits the one
#    case that asserts the old rename semantics: a correct fix necessarily changes which
#    operand that operation reports, so it is not an acceptance test.
cd "$ROOT/packages/argv-parser" || exit 1
./node_modules/.bin/vitest run \
   --reporter=junit --outputFile="$OUT/project-argv-parser.xml" \
   test || true

# 3. the project's own unit tests for the affected commands and the guard plugin
cd "$PKG" || exit 1
./node_modules/.bin/vitest run --project unit \
   --reporter=junit --outputFile="$OUT/project-simple-git.xml" \
   test/unit/rebase.spec.ts \
   test/unit/clean.spec.ts \
   test/unit/push.spec.ts \
   test/unit/rev-parse.spec.ts \
   test/unit/config.spec.ts \
   test/unit/plugins/plugin.unsafe.spec.ts \
   test/unit/plugins/plugins.allow-environment.spec.ts || true
