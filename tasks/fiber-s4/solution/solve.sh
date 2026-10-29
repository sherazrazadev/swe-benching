#!/bin/bash
# Reference fix: make every forwarding path that serves an incoming client request
# report only the address observed on the connection, replacing every value the
# client supplied (including repeated header lines).
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
