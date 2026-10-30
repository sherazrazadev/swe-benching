"""The connection-probe session accepts a certificate that covers the address."""
from __future__ import annotations

from support.tlsutil import LocalTLSServer, make_certificate

from snowflake.connector.tool.probe_connection import probe_connection


def test_probe_session_accepts_matching_certificate(tmp_path):
    cert, key = make_certificate("127.0.0.1", ip_addresses=["127.0.0.1"])
    server = LocalTLSServer(cert, key)
    addr = server.start()
    try:
        result = probe_connection(f"https://127.0.0.1:{addr[1]}/")
        assert result.get("certificates"), result
    finally:
        server.wait()
