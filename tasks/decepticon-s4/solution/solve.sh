#!/bin/bash
# Reference fix: make chat-template control literals inert wherever untrusted
# tool output is composed into a model-visible message, together with the
# composition sites the published change did not cover.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
