#!/bin/bash
# Reference fix: refuse any schema-supplied value that would not be a dotted Python identifier
# path before it can reach an emitted import or a generated base-class position — covering the
# reference-import declaration, the custom type paths (field and root), the nested type
# annotation route (including the swallowed-error path), the schema base path (single and
# list), and the injected field-level declaration and schema-level extra-import list.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
