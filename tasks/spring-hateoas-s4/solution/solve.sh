#!/bin/bash
# Reference fix: every place that materialises an application object from a document's name/value
# entries derives the property description from the mapper performing the read and writes only the
# exposed names the document actually supplies. Partial documents keep their initialised values.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
