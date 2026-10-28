#!/bin/bash
# Reference fix: model-produced text is parsed as data everywhere the product interprets it
# (the chat tool-call paths of every model family, the legacy family-dispatch copy, and the
# coordinate text of the image route), while ordinary JSON and Python-literal tool calls and
# legitimate coordinates keep working.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
