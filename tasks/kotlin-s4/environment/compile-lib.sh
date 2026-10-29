#!/usr/bin/env bash
# Compile the kapt-base module (the affected library) at the repository's Java level.
# Usage: compile-lib.sh [output-dir]
set -eu
OUT="${1:-/tmp/kapt-classes}"
JAVA_HOME="${JAVA_HOME:-/opt/java/openjdk}"
rm -rf "$OUT"
mkdir -p "$OUT"
JAVA_HOME="$JAVA_HOME" PATH="$JAVA_HOME/bin:$PATH" /opt/kotlin/kotlinc/bin/kotlinc \
    -d "$OUT" -nowarn -language-version 2.5 -api-version 2.5 -Xallow-pre-17-runtime-jdk \
    -cp "$JAVA_HOME/lib/tools.jar" \
    $(find /workspace/plugins/kapt/kapt-base/src -name '*.kt')
echo "compiled kapt-base into $OUT"
