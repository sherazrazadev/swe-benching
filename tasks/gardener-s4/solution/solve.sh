#!/bin/bash
# Apply the reference fix to the vulnerable checkout in /workspace.
set -euo pipefail
cd /workspace
patch -p1 --forward --no-backup-if-mismatch < /solution/fix.patch
