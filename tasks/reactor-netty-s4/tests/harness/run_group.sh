#!/usr/bin/env bash
# Runs one hidden group with the project's native runner and writes its JUnit XML to $2.
# Usage: run_group.sh <security|functional> <junit-xml-path>
set -u
group="$1"
out="$2"

case "$group" in
	security)   class="SecurityRedirectCredentialsTest" ;;
	functional) class="FunctionalRedirectCredentialsTest" ;;
	*)          echo "unknown group: $group" >&2; exit 2 ;;
esac

cd /workspace
results="/workspace/.htests/results-$group"
rm -rf "$results"
mkdir -p "$results"

HIDDEN_SRC=/workspace/.htests/src HIDDEN_RESULTS="$results" \
	./gradlew --offline --no-daemon --console=plain -q \
		-I /workspace/.htests/init.gradle \
		:reactor-netty-http:hiddenTest \
		--tests "hidden.$class"

xml=$(ls "$results"/TEST-*.xml 2>/dev/null | head -1)
if [ -n "$xml" ]; then
	cp "$xml" "$out"
else
	echo "no JUnit XML produced for $group" >&2
fi
