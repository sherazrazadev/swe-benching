#!/bin/bash
# Reference fix: render every chart tooltip through Lit templates (or otherwise keep
# system-supplied labels as text), including list-form, per-series and options-supplied
# tooltips, so a registered name can never become markup.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
