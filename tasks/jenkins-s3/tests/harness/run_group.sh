#!/bin/bash
# Compile one hidden group into the project's own test module and run it with the project's
# native runner, always leaving a JUnit XML behind (a compile or start-up failure is a failing
# group, never a missing result).
set -u
G=$1
OUT=$2
S=/workspace/.htests

export JAVA_HOME=/opt/java/openjdk
export PATH="$JAVA_HOME/bin:$PATH"

case "$G" in
  security) PATTERN='bench.Security*' ;;
  functional) PATTERN='bench.Functional*,hudson.util.RobustReflectionConverterTest' ;;
  *) PATTERN='bench.*' ;;
esac

MVN=(mvn -o -B -ntp -P '!yarn-execution' -Dyarn.lint.skip=true -Dmaven.repo.local=/opt/m2
     -Dspotbugs.skip -Dcheckstyle.skip -Denforcer.skip=true -Dspotless.check.skip=true
     -Djacoco.skip=true -Dmaven.test.failure.ignore=true -DfailIfNoTests=false)

DST=/workspace/test/src/test/java/bench
rm -rf "$DST" /workspace/test/target/test-classes/bench
mkdir -p "$DST"
cp "$S"/harness/*.java "$DST"/ 2>/dev/null
cp "$S"/$G/*.java "$DST"/ 2>/dev/null

cd /workspace || exit 0
rm -rf /workspace/test/target/surefire-reports
"${MVN[@]}" -pl test -Dtest="$PATTERN" test > "$S/mvn-$G.log" 2>&1

if [ "$G" = functional ]; then
  rm -rf /workspace/core/target/surefire-reports
  "${MVN[@]}" -pl core -Dtest='hudson.util.DescribableListTest' test >> "$S/mvn-$G.log" 2>&1
fi

python3 -I "$S/harness/merge_junit.py" "$OUT" \
    /workspace/test/target/surefire-reports \
    /workspace/core/target/surefire-reports > "$S/merge-$G.log" 2>&1
exit 0
