#!/bin/bash
# Run one hidden group with the JUnit Platform launcher and leave a JUnit XML behind even
# when compilation failed (a failed prepare is a failing group, never a missing result).
set -u
G=$1
OUT=$2
S=/workspace/.htests
BENCH=/opt/bench
JAVA=/opt/java/openjdk/bin/java
mkdir -p "$(dirname "$OUT")"

if [ -f "$S/prepare.failed" ]; then
  python3 -I "$S/harness/merge_junit.py" "$OUT" "$S/empty" >/dev/null 2>&1
  exit 0
fi

OUTDIR="$S/reports-$G"
rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"
ARGS=(execute --class-path "$S/classes:$S/test-classes:$(cat "$BENCH/cp.txt")"
      --reports-dir "$OUTDIR" --details=summary --disable-banner)
if [ "$G" = security ]; then
  ARGS+=(--select-package bench.security)
else
  ARGS+=(--select-package bench.functional
         --select-class org.graylog.plugins.views.search.rest.ViewsResourceTest
         --select-class org.graylog.events.rest.EventDefinitionsResourceTest)
fi
"$JAVA" -XX:+EnableDynamicAgentLoading -jar "$BENCH/junit-console.jar" "${ARGS[@]}" \
    > "$S/junit-$G.log" 2>&1
python3 -I "$S/harness/merge_junit.py" "$OUT" "$OUTDIR" >> "$S/merge-$G.log" 2>&1
exit 0
