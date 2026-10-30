#!/bin/bash
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
