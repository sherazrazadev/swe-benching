"""Small, backend-independent helpers shared by the hidden suites.

Everything here is plain test bookkeeping: temporary copies of the stored-state
fixtures and the wire encoding rules the Matrix protocol uses.  No product code
is called to build an expected value or to clean up.
"""

import importlib.util
import json
import os
import shutil
import sys
from base64 import b64decode, b64encode

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

ACCOUNT_V4_FIXTURE = "legacy_account_v4.db"
ACCOUNT_V2_FIXTURE = "legacy_account_v2.db"
INBOUND_GROUP_V1_FIXTURE = "legacy_inbound_group_v1.db"

FIXTURE_USER = "example"
FIXTURE_DEVICE = "DEVICEID"
FIXTURE_PICKLE_KEY = "DEFAULT_KEY"


def legacy_backend_available():
    """Is the deprecated backend importable in this interpreter?"""
    try:
        return importlib.util.find_spec("olm") is not None
    except (ImportError, ValueError):
        return False


def require_no_legacy_backend():
    """A security check only means something on a deployment without the old engine."""
    assert "olm" not in sys.modules, "the deprecated backend was imported by the library"
    assert not legacy_backend_available(), "the deprecated backend is installed"


def require_legacy_backend():
    """Functional checks keep the old engine installed, as an upgrading install does."""
    assert legacy_backend_available(), "the deprecated backend is required for this check"


def install_store_fixture(tmp_path, fixture_name, user_id=FIXTURE_USER,
                          device_id=FIXTURE_DEVICE):
    """Copy a stored-state fixture into a fresh store directory and return the path."""
    target = os.path.join(str(tmp_path), f"{user_id}_{device_id}.db")
    shutil.copyfile(os.path.join(DATA_DIR, fixture_name), target)
    return str(tmp_path)


def canonical_json(value):
    """The canonical JSON form used on the Matrix wire for signed objects."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def unpadded_b64decode(value):
    """Decode an unpadded base64 string (the Matrix wire form)."""
    padding = "=" * (-len(value) % 4)
    return b64decode(value + padding, validate=True)


def unpadded_b64encode(value):
    """Encode bytes as unpadded base64 (the Matrix wire form)."""
    return b64encode(value).decode().rstrip("=")
