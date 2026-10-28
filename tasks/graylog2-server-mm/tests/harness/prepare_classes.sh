#!/bin/bash
# Compile the submission's product sources and the hidden suites as the unprivileged test
# user. Prebuilt pristine classes and every dependency jar come from the verifier image;
# only product files that differ from the pristine baseline are recompiled. A compile
# failure is recorded (not raised) so the group still writes a failing result, never a
# missing one.
set -u
S=/workspace/.htests
BENCH=/opt/bench
JAVAC=/opt/java/openjdk/bin/javac
CP=$(cat "$BENCH/cp.txt")
rm -f "$S/prepare.failed"
fail() {
  printf '%s\n' "$*" > "$S/prepare.failed"
  printf '%s\n' "$*" >&2
  exit 0
}

rm -rf "$S/classes" "$S/test-classes"
mkdir -p "$S/classes" "$S/test-classes"
cp -R "$BENCH/classes/." "$S/classes/" || fail "cannot stage the prebuilt classes"

: > "$S/changed-sources.list"
while IFS= read -r f; do
  rel=${f#/workspace/}
  base="$BENCH/base-src/${rel#graylog2-server/src/main/java/}"
  if [ ! -f "$base" ] || ! cmp -s "$f" "$base"; then
    printf '%s\n' "$f" >> "$S/changed-sources.list"
  fi
done < <(find /workspace/graylog2-server/src/main/java -name '*.java' -type f)

if [ -s "$S/changed-sources.list" ]; then
  "$JAVAC" -proc:none -nowarn --release 21 -d "$S/classes" -cp "$S/classes:$CP" \
      @"$S/changed-sources.list" > "$S/javac-product.log" 2>&1 \
    || fail "product sources do not compile: $(tail -n 5 "$S/javac-product.log" | tr '\n' ' ')"
fi

find "$S/harness" "$S/security" "$S/functional" -name '*.java' -type f > "$S/test-sources.list"
"$JAVAC" -proc:none -nowarn --release 21 -d "$S/test-classes" -cp "$S/classes:$CP" \
    @"$S/test-sources.list" > "$S/javac-tests.log" 2>&1 \
  || fail "test sources do not compile: $(tail -n 5 "$S/javac-tests.log" | tr '\n' ' ')"
exit 0
