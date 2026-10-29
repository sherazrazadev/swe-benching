#!/bin/bash
# Reference fix: every content identity the product derives is a canonical,
# injective encoding of the entry's complete content, and every duplicate
# decision compares the complete content.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
