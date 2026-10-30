import pytest

import snowflake.connector.ssl_wrap_socket as ssw
from snowflake.connector.constants import OCSPMode


@pytest.fixture(autouse=True)
def _disable_ocsp():
    """The loopback servers do not speak OCSP; keep the wrap offline."""
    previous = ssw.FEATURE_OCSP_MODE
    ssw.FEATURE_OCSP_MODE = OCSPMode.DISABLE_OCSP_CHECKS
    try:
        yield
    finally:
        ssw.FEATURE_OCSP_MODE = previous
