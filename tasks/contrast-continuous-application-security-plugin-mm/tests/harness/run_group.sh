#!/bin/bash
# Compile one hidden group against the product built from the submitted workspace and run it,
# always leaving a JUnit XML behind (a compile or start-up failure is a failing group, never a
# missing result).
set -u
G=$1
OUT=$2
S=/workspace/.htests
CP="/workspace/target/classes:/workspace/target/test-classes:$(cat /opt/cp.txt)"
JAVA_HOME=/opt/java/openjdk
export JAVA_HOME
JAVAC="$JAVA_HOME/bin/javac"
JAVA="$JAVA_HOME/bin/java"

failxml() {
  {
    printf '<?xml version="1.0" encoding="UTF-8"?>\n'
    printf '<testsuite name="security-fix" tests="1" failures="1" errors="0" skipped="0">\n'
    printf ' <testcase classname="bench.ccas.%s" name="group">\n' "$G"
    printf '  <failure message="%s">%s</failure>\n' "$1" "$1"
    printf ' </testcase>\n</testsuite>\n'
  } > "$OUT"
}

D="$S/classes-$G"
rm -rf "$D"
mkdir -p "$D"
TMP="$S/tmp-$G"
rm -rf "$TMP"
mkdir -p "$TMP"
export TMPDIR="$TMP"
if ! "$JAVAC" -nowarn -cp "$CP" -d "$D" $S/harness/*.java $S/$G/*.java > "$S/javac-$G.log" 2>&1; then
  failxml "the group could not be compiled against the submitted code"
  tail -40 "$S/javac-$G.log"
  exit 0
fi

CLASSES=""
for f in $S/$G/*.java; do
  CLASSES="$CLASSES bench.ccas.$(basename "$f" .java)"
done

cd /workspace || exit 0
"$JAVA" \
  --add-opens java.base/java.lang=ALL-UNNAMED \
  --add-opens java.base/java.io=ALL-UNNAMED \
  --add-opens java.base/java.util=ALL-UNNAMED \
  -Dhudson.security.ExtendedReadPermission=true \
  -Djava.awt.headless=true \
  -Djava.io.tmpdir="$TMP" \
  -cp "$D:$CP" bench.ccas.JUnitXmlRunner "$OUT" $CLASSES > "$S/run-$G.log" 2>&1
rc=$?
cat "$S/run-$G.log"
[ -s "$OUT" ] || failxml "the group produced no results (exit $rc)"
exit 0
