import os
import sys

import pytest

from support import helpers

# The verifier keeps the legacy engine in a directory that is only added to
# the import path for this group, exactly like an installation that still
# carries it while upgrading.
LEGACY_BACKEND_DIR = "/opt/legacy-e2e"
if os.path.isdir(LEGACY_BACKEND_DIR) and LEGACY_BACKEND_DIR not in sys.path:
    sys.path.insert(0, LEGACY_BACKEND_DIR)


@pytest.fixture(autouse=True)
def legacy_backend_present():
    helpers.require_legacy_backend()
