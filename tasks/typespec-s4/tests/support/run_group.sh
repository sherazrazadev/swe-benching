#!/usr/bin/env bash
# Run one hidden group and write a single JUnit XML report.
#   run_group.sh <security|functional> <out.xml>
# The hidden suites run under plain Node (the compiler loads emitters dynamically and vitest
# cannot transform the Alloy packages those emitters pull in). The functional group also runs
# the project's own tests for the affected areas, each from its own package so its imports and
# fixtures resolve; the reports are merged into one document.
set -u
group="${1:?group}"
out="${2:?out}"
WS="${WORKSPACE:-/workspace}"
HIDDEN="$WS/packages/openapi3/test-hidden"
SUP="$HIDDEN/support"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

missing() {  # <name> <xml>: record an expected run that produced no report
  cat > "$2" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="$1"><testsuite name="$1" tests="1" failures="1"><testcase classname="$1" name="$1 produced a report"><failure message="$1 produced no JUnit report"/></testcase></testsuite></testsuites>
EOF
}

inputs=()

node "$SUP/run_hidden.mjs" "$WS/packages/openapi3/test-hidden/$group" "$tmp/hidden.xml" || true
if [ -s "$tmp/hidden.xml" ]; then inputs+=("$tmp/hidden.xml"); else missing "hidden-$group" "$tmp/hidden.xml"; inputs+=("$tmp/hidden.xml"); fi

if [ "$group" = "functional" ]; then
  run_project() {  # <package dir> <test file>
    local dir="$1" file="$2" name xml
    name="$(printf '%s' "$dir/$file" | tr '/.' '__')"
    xml="$tmp/$name.xml"
    ( cd "$WS/$dir" && ./node_modules/.bin/vitest run "$file" --reporter=junit --outputFile="$xml" >/dev/null 2>&1 ) || true
    if [ -s "$xml" ]; then inputs+=("$xml"); else missing "project-$name" "$xml"; inputs+=("$xml"); fi
  }
  run_project packages/openapi3 test/output-file.test.ts
  run_project packages/compiler test/helpers/path-interpolation.test.ts
  run_project packages/asset-emitter test/emitter.test.ts
  run_project packages/json-schema test/references.test.ts
  run_project packages/graphql test/emitter.test.ts
  run_project packages/protobuf test/scenarios.test.ts
fi

python3 -I "$SUP/merge_junit.py" "$out" "${inputs[@]}"
exit 0
