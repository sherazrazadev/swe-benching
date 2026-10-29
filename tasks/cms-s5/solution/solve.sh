#!/bin/bash
# Reference solution: treat every value the support widget receives as text. The remote result
# title, the messages returned by the support request and the remote result body shown in the
# hover preview are escaped/textualized, while the widget's own status indicator and result link
# stay real markup; the browser bundle the control panel serves is patched with the same fix.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
