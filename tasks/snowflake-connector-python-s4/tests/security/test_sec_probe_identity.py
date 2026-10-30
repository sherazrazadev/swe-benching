"""The connector's connection-probe TLS session must verify the peer name."""
from __future__ import annotations

import pytest

from support.tlsutil import LocalTLSServer, make_certificate

from snowflake.connector.tool.probe_connection import probe_connection


def test_probe_session_refuses_certificate_for_another_name(tmp_path):
    # The certificate's common name is the requested address, but its
    # subjectAltName covers a different host.
    cert, key = make_certificate("127.0.0.1", dns_names=["attacker.example"])
    server = LocalTLSServer(cert, key)
    addr = server.start()
    try:
        with pytest.raises(Exception):
            probe_connection(f"https://127.0.0.1:{addr[1]}/")
    finally:
        server.wait()
    assert server.received_application_data is False
