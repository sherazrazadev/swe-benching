#!/bin/bash
# Run one hidden group (security|functional) and write its merged JUnit XML to the given path.
# Runs as the unprivileged agent inside the verifier container.
set -u

group=${1:?group}
out=${2:?output xml}
HERE=$(cd "$(dirname "$0")" && pwd)
BASE=/workspace/.htests
SRC="$BASE/src/$group"
CLS="$BASE/classes/$group"
RAW="$BASE/raw/$group"
CP="$BASE/patch-classes:$(cat /opt/camel-test-cp.txt)"

rm -rf "$CLS" "$RAW"
mkdir -p "$CLS" "$RAW"

sources=()
while IFS= read -r f; do sources+=("$f"); done < <(find "$BASE/src/support" -name '*.java' 2>/dev/null)
while IFS= read -r f; do sources+=("$f"); done < <(find "$SRC" -name '*.java' 2>/dev/null)
if [ "$group" = functional ] && [ -d /opt/project-tests ]; then
    while IFS= read -r f; do sources+=("$f"); done < <(find /opt/project-tests -name '*.java' 2>/dev/null)
fi

if ! javac -nowarn -encoding UTF-8 -cp "$CP" -d "$CLS" "${sources[@]}" > "$BASE/$group-compile.log" 2>&1; then
    python3 -I "$HERE/write-failure.py" "$out" \
        "the submission no longer compiles against the documented product API"
    exit 0
fi

TEST_CP="$CP:/opt/project-tests-resources:$CLS:/opt/junit/junit-platform-console-standalone.jar"
java -cp "$TEST_CP" \
    org.junit.platform.console.ConsoleLauncher execute \
    --disable-banner --fail-if-no-tests --include-classname '.*' \
    --reports-dir "$RAW" --scan-classpath "$CLS" > "$BASE/$group-run.log" 2>&1
rc=$?

python3 -I "$HERE/merge-junit.py" "$out" "$RAW" || true
if [ ! -s "$out" ]; then
    python3 -I "$HERE/write-failure.py" "$out" "the runner produced no results (exit $rc)"
fi

exit 0
