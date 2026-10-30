#!/bin/bash
# Build the submitted product sources offline, as the unprivileged agent user.
set -uo pipefail
cd /workspace || exit 1
export HOME=/home/agent
export MAVEN_OPTS="${MAVEN_OPTS:-} -Xmx1g"
mkdir -p .htests || exit 1

if ! mvn -B -ntp -o -q \
        -Dmaven.repo.local=/home/agent/.m2/repository \
        -DskipTests \
        -pl hsweb-authorization/hsweb-authorization-oauth2 -am \
        compile > .htests/mvn-compile.log 2>&1; then
	echo "product sources did not compile" >&2
	tail -40 .htests/mvn-compile.log >&2
	exit 1
fi

exit 0
