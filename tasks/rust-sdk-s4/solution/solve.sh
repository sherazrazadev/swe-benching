#!/bin/bash
# Reference fix: a protected-resource metadata document is used only when its
# resource identifier is the MCP server's own address, every authorization
# server the client acts on comes from such a document, and every token request
# is bound to that same address.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
