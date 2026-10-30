"""Explicit verification opt-out and caller TLS settings keep working."""
from __future__ import annotations

import ssl

from support.tlsutil import LocalTLSServer, ca_file, connect, make_certificate

import snowflake.connector.network  # noqa: F401  installs the connector TLS wrap
import snowflake.connector.ssl_wrap_socket as ssw
from snowflake.connector.vendored.urllib3.connection import HTTPSConnection


def test_verification_off_accepts_a_different_hostname(tmp_path):
    # A caller that explicitly disabled certificate verification must still get
    # a connection, even to a certificate naming another server.
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key)
    addr = server.start()
    connection = HTTPSConnection(
        "127.0.0.1",
        addr[1],
        server_hostname="other.example",
        cert_reqs=ssl.CERT_NONE,
        ca_certs=ca,
        timeout=8,
    )
    try:
        connection.connect()
        assert connection.sock is not None
    finally:
        connection.close()
        server.wait()


def test_verification_off_accepts_no_server_name(tmp_path):
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    source = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    source.check_hostname = False
    source.verify_mode = ssl.CERT_NONE
    server = LocalTLSServer(cert, key)
    addr = server.start()
    sock = connect(addr)
    wrapped = None
    try:
        wrapped = ssw.ssl_wrap_socket_with_ocsp(
            sock=sock,
            server_hostname=None,
            ssl_context=source,
            ca_certs=ca,
        )
        assert wrapped is not None
    finally:
        if wrapped is not None:
            wrapped.close()
        sock.close()
        server.wait()


def test_matching_caller_protocol_floor_still_connects(tmp_path):
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key, max_version=ssl.TLSVersion.TLSv1_2)
    addr = server.start()

    source = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    source.minimum_version = ssl.TLSVersion.TLSv1_2

    sock = connect(addr)
    wrapped = None
    try:
        wrapped = ssw.ssl_wrap_socket_with_ocsp(
            sock=sock,
            server_hostname="localhost",
            ssl_context=source,
            ca_certs=ca,
        )
        assert wrapped is not None
    finally:
        if wrapped is not None:
            wrapped.close()
        sock.close()
        server.wait()
