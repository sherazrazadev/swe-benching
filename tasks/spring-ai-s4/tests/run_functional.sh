#!/usr/bin/env bash
# Runs the hidden functional suite (including pristine copies of the project's own
# converter tests) as the unprivileged verifier user. $1 is the agent-writable
# directory where the JUnit XML must be written.
set -uo pipefail
OUT="${1:?output directory}"
cd /workspace || exit 1
CP="/workspace/spring-ai-vector-store/target/classes:/workspace/vector-stores/spring-ai-elasticsearch-store/target/classes:/workspace/vector-stores/spring-ai-opensearch-store/target/classes:/workspace/vector-stores/spring-ai-gemfire-store/target/classes:$(cat /opt/sai-test-cp.txt):/opt/junit-platform-console-standalone.jar:/opt/assertj-core.jar"
D=/workspace/.htests/classes-functional
rm -rf "$D"
mkdir -p "$D" "$OUT"
if ! javac --release 17 -nowarn -cp "$CP" -d "$D" .htests/support/*.java .htests/functional/*.java .htests/project/*.java > .htests/javac-functional.log 2>&1; then
  printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?><testsuite name="compile" tests="1" failures="1"><testcase classname="org.springframework.ai.vectorstore.htests.Compile" name="functionalSuiteCompiles"><failure message="the submitted code does not compile against the hidden functional suite"/></testcase></testsuite>' > "$OUT/compile.xml"
  tail -40 .htests/javac-functional.log
  exit 0
fi
java -jar /opt/junit-platform-console-standalone.jar execute \
  --class-path "$D:$CP" \
  --select-class org.springframework.ai.vectorstore.htests.functional.LuceneQueryFunctionalTests \
  --select-class org.springframework.ai.vectorstore.elasticsearch.ElasticsearchAiSearchFilterExpressionConverterTest \
  --select-class org.springframework.ai.vectorstore.opensearch.OpenSearchAiSearchFilterExpressionConverterTest \
  --select-class org.springframework.ai.vectorstore.gemfire.GemFireAiSearchFilterExpressionConverterTest \
  --reports-dir "$OUT" --disable-banner --details=summary \
  > .htests/run-functional.log 2>&1
rc=$?
if ! ls "$OUT"/*.xml >/dev/null 2>&1; then
  printf '%s\n' "<?xml version=\"1.0\" encoding=\"UTF-8\"?><testsuite name=\"functional\" tests=\"1\" failures=\"1\"><testcase classname=\"org.springframework.ai.vectorstore.htests.Run\" name=\"functionalSuiteRuns\"><failure message=\"the hidden functional suite produced no results (exit $rc)\"/></testcase></testsuite>" > "$OUT/run.xml"
fi
cat .htests/run-functional.log
exit 0
