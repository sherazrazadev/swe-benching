#!/bin/bash
# Runs one hidden group over the prompt command and writes JUnit XML.
#   run_suite.sh security|functional <out.xml>
# The hidden security tests are named TestSec_*, the hidden functional tests TestFunc_*; the
# project's own config, color and prompt suites are part of the functional group.
set -u
mode=$1
out=$2

export LC_ALL=C.UTF-8 LANG=C.UTF-8 TZ=UTC
export GOTOOLCHAIN=local GOFLAGS=-mod=mod CGO_ENABLED=0 \
       GOMODCACHE=/go/pkg/mod GOCACHE=/go/cache
export OMP_BIN=/workspace/.htests/omp

cd /workspace/src || exit 1

{
  if [ "$mode" = "security" ]; then
    go test ./ompverify -run '^TestSec_' -count=1 -v
  else
    go test ./ompverify -run '^TestFunc_' -count=1 -v
    go test ./config ./color ./prompt -count=1 -v
  fi
} 2>&1 | go-junit-report -set-exit-code >"$out"
