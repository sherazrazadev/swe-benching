#!/bin/bash
# Runs one hidden group with the project's native runner (Maven + JUnit 4) and writes a
# single JUnit XML report to the path given as $2. Any failure to produce results is
# reported as a failing test case, never as a verifier fault, so a submission that does
# not build scores 0 instead of turning into a trial error.
set -u
group=$1
out=$2
cd /workspace || {
	printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>' \
		'<testsuite name="harness" tests="1" failures="1" errors="0" skipped="0">' \
		'  <testcase classname="harness.Submission" name="suiteExecutes"><failure message="workspace missing">workspace missing</failure></testcase>' \
		'</testsuite>' > "$out"
	exit 0
}

REPORT=/workspace/.htests/reports-$group
rm -rf "$REPORT"
# Drop any test reports a previous build left behind, so only this run's results count.
find /workspace -type d -name surefire-reports -prune -exec rm -rf {} + 2>/dev/null
# The project's build reads revision information from git; the verifier restores the
# workspace without history, so give it a baseline commit.
if [ ! -d /workspace/.git ]; then
	git init -q /workspace && \
		git -C /workspace -c user.name=task -c user.email=task@localhost \
			commit -q --allow-empty -m "Starting project"
fi
if [ "$group" = security ]; then
	PATTERN='*SecurityTest'
else
	PATTERN='*FunctionalTest,LooseFileUnpackerTest,DefaultFileUnpackerTest,Pack200FileUnpackerTest,ScriptParserTest,MultiVolumeFileUnpackerTest'
fi

mvn -B -ntp -o -pl izpack-installer -am test \
	-Dtest="$PATTERN" \
	-DfailIfNoTests=false \
	-Dsurefire.failIfNoSpecifiedTests=false \
	> "/workspace/.htests/$group.log" 2>&1

python3 /workspace/.htests/merge_junit.py /workspace "$out"
exit 0
