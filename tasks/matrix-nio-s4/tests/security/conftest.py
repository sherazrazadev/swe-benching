import pytest

from support import helpers


@pytest.fixture(autouse=True)
def no_deprecated_backend():
    """Every check in this group runs on a deployment without the deprecated engine."""
    helpers.require_no_legacy_backend()
