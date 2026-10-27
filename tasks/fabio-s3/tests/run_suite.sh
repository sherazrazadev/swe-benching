#!/usr/bin/env bash
# Runs one hidden group over the proxy package and writes JUnit XML.
#   run_suite.sh security|functional <out.xml>
# The hidden security tests are named TestSec*, the hidden functional tests TestFun*; the rest of
# the functional selection is the project's own affected-area tests, restored into the package.
set -u
mode="${1:?usage: run_suite.sh security|functional <out.xml>}"
out="${2:?usage: run_suite.sh security|functional <out.xml>}"

export LC_ALL=C.UTF-8 LANG=C.UTF-8 TZ=UTC
export GOTOOLCHAIN=local GOFLAGS=-mod=mod CGO_ENABLED=0 \
       GOMODCACHE=/go/pkg/mod GOCACHE=/go/cache \
       FABIO_BIN="${FABIO_BIN:-/workspace/.htests/fabio}"

case "$mode" in
  security)
    run='^TestSec'
    ;;
  functional)
    run='^(TestFun.*|TestProxyProducesCorrectXForwardedSomethingHeader|TestProxyRequestIDHeader|TestProxySTSHeader|TestProxyChecksHeaderForAccessRules|TestProxyNoRouteHTML|TestProxyNoRouteStatus|TestProxyStripsPath|TestProxyPrependsPath|TestProxyHost|TestHostRedirect|TestPathRedirect|TestProxyLogOutput|TestProxyHTTPSUpstream|TestProxyHTTPSTransport|TestProxyHTTPSUpstreamSkipVerify|TestProxyGzipHandler|TestProxyWSUpstream)$'
    ;;
  *)
    echo "unknown group: $mode" >&2
    exit 2
    ;;
esac

cd /workspace || exit 1
go test ./proxy -run "$run" -count=1 -v -timeout 240s 2>&1 | go-junit-report -set-exit-code >"$out"
