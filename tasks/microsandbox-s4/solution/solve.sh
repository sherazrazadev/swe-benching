#!/bin/bash
# Reference fix: the launched sandbox process keeps only operator-readable labels on its command
# line; the complete launch configuration (environment, secrets, network settings, mounts, workload
# and hand-off settings) is handed to the runtime over an inherited anonymous file descriptor, and
# every additional command-line emission of configured values is removed.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
