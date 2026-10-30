#!/usr/bin/env bash
# Runs the hidden security suite as the unprivileged verifier user. $1 is the
# agent-writable directory where the JUnit XML must be written.
set -uo pipefail
OUT="${1:?output directory}"
cd /workspace || exit 1
CP="/workspace/spring-ai-vector-store/target/classes:/workspace/vector-stores/spring-ai-elasticsearch-store/target/classes:/workspace/vector-stores/spring-ai-opensearch-store/target/classes:/workspace/vector-stores/spring-ai-gemfire-store/target/classes:$(cat /opt/sai-test-cp.txt):/opt/junit-platform-console-standalone.jar:/opt/assertj-core.jar"
D=/workspace/.htests/classes-security
rm -rf "$D"
mkdir -p "$D" "$OUT"
if ! javac --release 17 -nowarn -cp "$CP" -d "$D" .htests/support/*.java .htests/security/*.java > .htests/javac-security.log 2>&1; then
  printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?><testsuite name="compile" tests="1" failures="1"><testcase classname="org.springframework.ai.vectorstore.htests.Compile" name="securitySuiteCompiles"><failure message="the submitted code does not compile against the hidden security suite"/></testcase></testsuite>' > "$OUT/compile.xml"
  tail -40 .htests/javac-security.log
  exit 0
fi
java -jar /opt/junit-platform-console-standalone.jar execute \
  --class-path "$D:$CP" \
  --select-class org.springframework.ai.vectorstore.htests.security.LuceneQueryInjectionSecurityTests \
  --reports-dir "$OUT" --disable-banner --details=summary \
  > .htests/run-security.log 2>&1
rc=$?
if ! ls "$OUT"/*.xml >/dev/null 2>&1; then
  printf '%s\n' "<?xml version=\"1.0\" encoding=\"UTF-8\"?><testsuite name=\"security\" tests=\"1\" failures=\"1\"><testcase classname=\"org.springframework.ai.vectorstore.htests.Run\" name=\"securitySuiteRuns\"><failure message=\"the hidden security suite produced no results (exit $rc)\"/></testcase></testsuite>" > "$OUT/run.xml"
fi
cat .htests/run-security.log
exit 0
