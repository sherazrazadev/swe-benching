"""Shared setup for the hidden suites.

The applications are driven in-process through the product's real routes; the CLI
start-up path is exercised too (see support/harness.py). The environment is cleared
between tests so each scenario declares exactly the configuration it needs.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import pytest  # noqa: E402

from support import harness  # noqa: E402


@pytest.fixture(autouse=True)
def clean_environment():
    harness.reset_env()
    yield
    harness.reset_env()
