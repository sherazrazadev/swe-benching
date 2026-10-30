#!/bin/bash
# Runs one hidden group with the project's native Maven runner and writes a single JUnit XML.
# Usage: run.sh <security|functional> <output-xml>
set -u
GROUP="$1"
OUT="$2"
HT=/workspace/.htests
cd /workspace || exit 1
if [ "$GROUP" = security ]; then
    SRC="$HT/security"
    PATTERN='HiddenProfileSecurityTest,HiddenProfileServiceSecurityTest'
else
    SRC="$HT/functional"
    PATTERN='HiddenProfileFunctionalTest,HiddenProfileServiceFunctionalTest,ProfileServiceTests'
fi
mkdir -p webapi/src/test/java profile2/impl/src/test
cp -r "$SRC/java/webapi/." webapi/src/test/java/ || true
cp -r "$SRC/java/impl/." profile2/impl/src/test/ || true
rm -rf profile2/api/target/surefire-reports profile2/util/target/surefire-reports \
       profile2/impl/target/surefire-reports webapi/target/surefire-reports
mvn -o -B -ntp -fae \
    -pl profile2/api,profile2/util,profile2/impl,webapi test \
    -Dtest="$PATTERN" \
    -DfailIfNoTests=false \
    -Dsurefire.failIfNoSpecifiedTests=false \
    -Dmaven.test.redirectTestOutputToFile=false > "$HT/$GROUP.mvn.log" 2>&1
python3 -I "$HT/merge_xml.py" "$OUT" "$GROUP" \
    profile2/impl/target/surefire-reports webapi/target/surefire-reports
exit 0
