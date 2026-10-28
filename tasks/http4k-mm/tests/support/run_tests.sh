#!/usr/bin/env bash
# Compile and run one hidden group against the submission's built classes.
# Writes a single JUnit XML file to $2 and always exits 0; a compile/run problem is
# recorded as an errored test so the scorer sees a failure rather than an infrastructure
# fault.
set -uo pipefail

GROUP="$1"
OUT="$2"
WORK=/workspace/.htests
DEPS="$WORK/deps"
SRC="$WORK/$GROUP-src"
CLASSES="$WORK/$GROUP-classes"
REPORTS="$WORK/$GROUP-reports"

export JAVA_HOME="${JAVA_HOME:-/opt/java/openjdk}"
export PATH="$JAVA_HOME/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p "$WORK"
rm -rf "$CLASSES" "$REPORTS"
mkdir -p "$CLASSES" "$REPORTS"

fail() {
    local msg="$1"
    printf '%s\n' "{\"error\":\"$msg\"}" > "$WORK/$GROUP-error.json"
    cat > "$OUT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="hidden-$GROUP" tests="1" failures="0" errors="1" skipped="0">
  <testcase classname="hidden.$GROUP" name="hidden suite $GROUP">
    <error message="$msg"><![CDATA[$msg]]></error>
  </testcase>
</testsuite>
EOF
    exit 0
}

mkdir -p "$DEPS"
DEPS_OUT="$DEPS" GRADLE_USER_HOME=/home/agent/.gradle \
    /workspace/gradlew --offline --no-daemon -q \
    -Dorg.gradle.jvmargs="-Xmx3g -XX:MaxMetaspaceSize=1g" \
    -Pkotlin.compiler.execution.strategy=in-process \
    -I "$WORK/support/deps.init.gradle" \
    :http4k-core:copyRuntimeDeps :http4k-testing-webdriver:copyRuntimeDeps \
    > "$WORK/$GROUP-deps.log" 2>&1 || fail "dependency resolution failed"

DEPCP=$(find "$DEPS" -name '*.jar' | sort | paste -sd: -)
[ -n "$DEPCP" ] || fail "no dependency jars were resolved"

MODCP="/workspace/core/testing/webdriver/build/classes/kotlin/main"
RESCP="/workspace/core/testing/webdriver/build/resources/main"
CP="$DEPCP:$MODCP:$RESCP:/opt/junit-console.jar"

# shellcheck disable=SC2046
/opt/kotlin/bin/kotlinc -classpath "$CP" -d "$CLASSES" \
    $(find "$SRC" "$WORK/support" -name '*.kt' | sort) > "$WORK/$GROUP-compile.log" 2>&1 \
    || fail "hidden suite compilation failed"

SELECT=""
while IFS= read -r cls; do
    [ -n "$cls" ] || continue
    SELECT="$SELECT --select-class $cls"
done < "$WORK/support/$GROUP.classes"

# shellcheck disable=SC2086
java -jar /opt/junit-console.jar execute --class-path "$CLASSES:$CP" \
    $SELECT --reports-dir "$REPORTS" --disable-banner --details=summary \
    > "$WORK/$GROUP-run.log" 2>&1

if [ -f "$REPORTS/TEST-junit-jupiter.xml" ]; then
    cp "$REPORTS/TEST-junit-jupiter.xml" "$OUT"
else
    fail "hidden suite produced no results"
fi
exit 0
