#!/bin/bash
# Image-build preparation (network is available here). Build the pinned project once so the agent
# can build offline, and run the project's own tests for the affected area at the pinned commit.
set -euo pipefail
export HOME=/home/agent
export MAVEN_OPTS="${MAVEN_OPTS:-} -Xmx2g"
cd /workspace

MODULES=(-pl hsweb-system/hsweb-system-authorization/hsweb-system-authorization-oauth2 -am)

mvn -B -ntp -DskipTests install "${MODULES[@]}"

mvn -B -ntp -o -pl hsweb-authorization/hsweb-authorization-oauth2 test
