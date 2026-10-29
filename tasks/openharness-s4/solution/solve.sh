#!/bin/bash
# Reference fix: make every command that can place chat-supplied text into the assistant's
# system prompt local-only, and remove the gateway shortcut that skipped that check.
set -euo pipefail
cd /workspace
patch -p1 < "$(dirname "$0")/fix.patch"
