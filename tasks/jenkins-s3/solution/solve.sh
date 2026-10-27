#!/bin/bash
# Reference fix: enforce the declared element type of every configuration collection at the
# field/converter boundary (including type variables resolved against the concrete configured
# class), and refuse to recreate request-routing and plugin objects from submitted configuration.
# Legitimate values of the permitted types keep loading.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
