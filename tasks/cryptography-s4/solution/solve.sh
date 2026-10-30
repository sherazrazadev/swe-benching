#!/bin/bash
# Reference fix: a wildcard DNS name is evaluated as the set of names it can
# stand for. A permitted subtree must contain that whole set; an excluded
# subtree excludes it on any overlap. Constraint evaluation also runs for
# self-issued certificates in the path, and requested-name matching keeps its
# exactly-one-label semantics.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
