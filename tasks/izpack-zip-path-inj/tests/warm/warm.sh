#!/bin/bash
# Populate the Maven dependency cache and run the project's own tests for the affected area.
set -euo pipefail
cd "${1:-/workspace}"
mvn -B -ntp -pl izpack-installer -am test \
	-Dtest='LooseFileUnpackerTest,DefaultFileUnpackerTest,Pack200FileUnpackerTest,ScriptParserTest,MultiVolumeFileUnpackerTest' \
	-DfailIfNoTests=false \
	-Dsurefire.failIfNoSpecifiedTests=false
