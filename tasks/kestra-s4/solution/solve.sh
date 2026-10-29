#!/bin/bash
# Reference fix: allowlist the values the custom Markdown link tag actually uses, render its
# custom display text as text, escape the documentation shorthand's argument, and render link
# titles as text in the post-render tooltip. Includes the published change that turns the
# rendered link element into router anchors.
set -euo pipefail
cd /workspace
SOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
git apply --verbose "${SOL_DIR}/fix.patch" 2>/dev/null || patch -p1 < "${SOL_DIR}/fix.patch"
