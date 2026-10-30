"""TLS settings a caller supplies must not be silently weakened."""
from __future__ import annotations

import ssl

import pytest

from support.tlsutil import LocalTLSServer, ca_file, connect, make_certificate

import snowflake.connector.ssl_wrap_socket as ssw


def test_caller_protocol_floor_is_enforced(tmp_path):
    # The server only speaks TLS 1.2; a caller that requires TLS 1.3 must not
    # end up on a TLS 1.2 connection.
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key, max_version=ssl.TLSVersion.TLSv1_2)
    addr = server.start()

    source = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    source.minimum_version = ssl.TLSVersion.TLSv1_3

    sock = connect(addr)
    try:
        with pytest.raises(Exception):
            ssw.ssl_wrap_socket_with_ocsp(
                sock=sock,
                server_hostname="localhost",
                ssl_context=source,
                ca_certs=ca,
            )
    finally:
        sock.close()
        server.wait()
