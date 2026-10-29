#!/bin/bash
# Reference fix: the shipped Kubernetes-audit detection sees per-container security settings on
# every container the request would run, whichever container list carries it, including the
# request shape used to attach containers to a running pod; the field catalogue exposes the same
# values for every list; and the regular-container values and trusted-image allowance keep their
# existing meaning.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
