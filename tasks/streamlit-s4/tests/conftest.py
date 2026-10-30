from __future__ import annotations

import pytest

from support import cache_env


@pytest.fixture(autouse=True)
def _cache_environment():
    """Give every test a fresh public-cache environment."""
    cache_env.install()
    cache_env.reset()
    yield
    cache_env.reset()
