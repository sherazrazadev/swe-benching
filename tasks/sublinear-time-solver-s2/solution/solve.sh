#!/bin/bash
# Reference fix: confine every client-supplied file name or derived path to its feature's
# directory at the service boundary, validate every caller-supplied path part, refuse to
# follow a link at the final component, and leave the embedders' SDK state API untouched.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
