#!/bin/bash
# Compile and run one hidden suite against the submitted product classes, writing a single JUnit
# XML report to the given path.
set -u
group=$1
out=$2

emit_failure() {
	printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>' \
		"<testsuite name=\"bench.$group\" tests=\"1\" failures=\"1\" errors=\"0\" skipped=\"0\">" \
		"  <testcase classname=\"bench.$group.Submission\" name=\"suiteExecutes\"><failure message=\"$1\">$1</failure></testcase>" \
		'</testsuite>' > "$out"
}

cd /workspace || { emit_failure "workspace missing"; exit 0; }
CP=$(cat /opt/bench-classpath.txt) || { emit_failure "classpath missing"; exit 0; }
CONSOLE=/workspace/.htests/junit-console.jar
CLASSES="/workspace/.htests/classes-$group"
REPORT="/workspace/.htests/report-$group"
rm -rf "$CLASSES" "$REPORT"
mkdir -p "$CLASSES" "$REPORT" || { emit_failure "work dir unavailable"; exit 0; }

PRODUCT=$(find /workspace -type d -path '*/target/classes' | paste -sd: -)
if [ -z "$PRODUCT" ]; then
	emit_failure "product classes missing"
	exit 0
fi

SOURCES=$(find "/workspace/.htests/$group" /workspace/.htests/support -name '*.java')
if ! javac -nowarn -encoding UTF-8 --release 17 -cp "$CP:$PRODUCT:$CONSOLE" -d "$CLASSES" $SOURCES; then
	emit_failure "suite did not compile"
	exit 0
fi

java -jar "$CONSOLE" --class-path "$CP:$PRODUCT:$CLASSES:$CONSOLE" \
	--scan-class-path "$CLASSES" --reports-dir "$REPORT" --disable-banner --details=summary \
	> "/workspace/.htests/$group.log" 2>&1

REPORT_XML="$REPORT/TEST-junit-jupiter.xml"
[ -f "$REPORT_XML" ] || REPORT_XML=$(ls "$REPORT"/TEST-*.xml 2>/dev/null | head -1)
if [ -n "$REPORT_XML" ] && [ -f "$REPORT_XML" ]; then
	cp "$REPORT_XML" "$out"
else
	emit_failure "suite produced no report"
fi
exit 0
