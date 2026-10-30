#!/bin/bash
# Reference fix: verify the peer certificate names the requested server on every TLS
# connection, keep the caller's TLS settings across the connector's own setup, and replace
# the probe path's common-name-only comparison with a subject-name match.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
