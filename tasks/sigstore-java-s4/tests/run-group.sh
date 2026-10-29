#!/usr/bin/env bash
# Run one hidden JUnit group against the restored workspace and write a single JUnit XML file.
# Compiles the hidden sources with javac against the project's own test runtime classpath so the
# submission's test sources are never compiled or run.
set -u
GROUP="$1"
OUT="$2"
BASE="${HIDDEN_BASE:-/workspace/.htests}"
WS="${HIDDEN_WORKSPACE:-/workspace}"
JUNIT="${HIDDEN_JUNIT:-/opt/junit/junit-platform-console-standalone.jar}"
export JAVA_HOME="${JAVA_HOME:-/opt/java/openjdk}"
export PATH="$JAVA_HOME/bin:/usr/local/bin:/usr/bin:/bin"
export GRADLE_USER_HOME="${HIDDEN_GRADLE_USER_HOME:-/home/agent/.gradle}"

emit_failure() {
  python3 "$BASE/fail-xml.py" "$OUT" "$1"
  exit 0
}

if [ ! -s "$BASE/classpath.txt" ]; then
  cd "$WS" || emit_failure "workspace missing"
  ./gradlew --offline -q -I "$BASE/classpath.gradle" \
      :sigstore-java:classes :sigstore-java:hiddenTestClasspath \
      > "$BASE/classpath.raw" 2> "$BASE/classpath.err"
  sed -n 's/^HIDDEN_CP=//p' "$BASE/classpath.raw" > "$BASE/classpath.txt"
fi
if [ ! -s "$BASE/classpath.txt" ]; then
  emit_failure "the project's test classpath could not be resolved offline"
fi
CP=$(cat "$BASE/classpath.txt")

if [ ! -f "$BASE/classes/.stamp" ]; then
  rm -rf "$BASE/classes"
  mkdir -p "$BASE/classes"
  if ! javac -nowarn -cp "$JUNIT:$CP" -d "$BASE/classes" \
       $(find "$BASE/src" -name '*.java' | sort) > "$BASE/javac.log" 2>&1; then
    emit_failure "the hidden suites did not compile against the submission"
  fi
  touch "$BASE/classes/.stamp"
fi

REPORTS="$BASE/reports-$GROUP"
rm -rf "$REPORTS"
mkdir -p "$REPORTS"
if [ "$GROUP" = "security" ]; then
  SELECT=(--select-class dev.sigstore.hidden.SecurityTests
          --select-class dev.sigstore.hidden.FetcherSecurityTests)
else
  SELECT=(--select-class dev.sigstore.hidden.FunctionalTests)
fi

java -Dhidden.resources="$BASE/resources" -cp "$JUNIT:$CP:$BASE/classes" \
    org.junit.platform.console.ConsoleLauncher \
    "${SELECT[@]}" --disable-banner --details=summary --reports-dir="$REPORTS" \
    > "$BASE/$GROUP.log" 2>&1

python3 "$BASE/merge-xml.py" "$REPORTS" "$OUT" "$GROUP"
exit 0
