"""Shared setup for the hidden suites: local HTTP requests only, no network."""

import os

import pytest


@pytest.fixture(autouse=True)
def insecure_local_transport():
    os.environ["AUTHLIB_INSECURE_TRANSPORT"] = "true"
    yield
