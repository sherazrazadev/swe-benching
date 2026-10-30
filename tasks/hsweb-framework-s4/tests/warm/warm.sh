#!/bin/bash
# Verifier-side preparation (network is available at image build time). Warm the Maven repository
# from the pinned commit and record every third-party jar the hidden suites need, so the submitted
# workspace compiles and the suites run with no network.
set -euo pipefail
export HOME=/home/agent
export MAVEN_OPTS="${MAVEN_OPTS:-} -Xmx2g"
cd /tmp/warm

MODULE=hsweb-system/hsweb-system-authorization/hsweb-system-authorization-oauth2

mvn -B -ntp -DskipTests install -pl "$MODULE" -am

mvn -B -ntp -q dependency:build-classpath \
    -Dmdep.includeScope=test \
    -Dmdep.outputFile=/tmp/raw-cp.txt \
    -pl "$MODULE"

# Keep only third-party jars: the project's own modules are rebuilt from the submitted workspace.
tr ':' '\n' < /tmp/raw-cp.txt \
    | grep -v '/org/hswebframework/web/' \
    | grep -v '^$' \
    | paste -sd: - > /tmp/bench-classpath.txt

test -s /tmp/bench-classpath.txt
