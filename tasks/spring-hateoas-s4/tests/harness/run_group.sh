#!/bin/bash
# Compile one hidden group into the project's own test sources and run it with the project's
# native runner, always leaving a JUnit XML behind (a compile or start-up failure is a failing
# group, never a missing result).
set -u
G=$1
OUT=$2
S=/workspace/.htests

export JAVA_HOME=/opt/java/openjdk
export PATH="$JAVA_HOME/bin:$PATH"

MVN=(mvn -o -B -ntp -Dmaven.repo.local=/opt/m2 -Dmaven.test.failure.ignore=true
     -DfailIfNoTests=false -Dsurefire.failIfNoSpecifiedTests=false -Djacoco.skip=true
     -Dspotbugs.skip=true -Dcheckstyle.skip=true)

case "$G" in
  security) PATTERN='bench.Security*' ;;
  functional) PATTERN='bench.Functional*,org.springframework.hateoas.mediatype.collectionjson.CollectionJsonJacksonModuleIntegrationTest,org.springframework.hateoas.mediatype.uber.UberJacksonModuleIntegrationTest,org.springframework.hateoas.mediatype.hal.forms.HalFormsJacksonModuleIntegrationTest' ;;
  *) PATTERN='bench.*' ;;
esac

DST=/workspace/src/test/java/bench
rm -rf "$DST" /workspace/target/test-classes/bench /workspace/target/surefire-reports
mkdir -p "$DST"
cp "$S"/harness/*.java "$DST"/ 2>/dev/null
cp "$S"/$G/*.java "$DST"/ 2>/dev/null

cd /workspace || exit 0
"${MVN[@]}" -Dtest="$PATTERN" test > "$S/mvn-$G.log" 2>&1

python3 -I "$S/harness/merge_junit.py" "$OUT" /workspace/target/surefire-reports > "$S/merge-$G.log" 2>&1
exit 0
