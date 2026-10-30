#!/bin/bash
# Reference fix: render theme-authored template text with the full helper set and
# runtime-composed text with a restricted one, keep the trust level out of the
# parsed-template cache and off pooled render objects, and use the restricted
# renderer for every place that renders text built outside the theme.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
