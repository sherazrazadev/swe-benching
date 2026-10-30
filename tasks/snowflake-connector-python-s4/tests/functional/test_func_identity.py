"""A certificate that covers the requested server name keeps working."""
from __future__ import annotations

import ssl

from support.tlsutil import LocalTLSServer, ca_file, connect, make_certificate

import snowflake.connector.network  # noqa: F401  installs the connector TLS wrap
import snowflake.connector.ssl_wrap_socket as ssw
from snowflake.connector.vendored.urllib3.connection import HTTPSConnection


def test_matching_dns_name_is_accepted_by_tls_wrap(tmp_path):
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key)
    addr = server.start()
    sock = connect(addr)
    wrapped = None
    try:
        wrapped = ssw.ssl_wrap_socket_with_ocsp(
            sock=sock,
            server_hostname="localhost",
            ssl_context=None,
            ca_certs=ca,
        )
        assert wrapped is not None
    finally:
        if wrapped is not None:
            wrapped.close()
        sock.close()
        server.wait()


def test_matching_dns_name_is_accepted_by_https_connection(tmp_path):
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key)
    addr = server.start()
    connection = HTTPSConnection(
        "127.0.0.1",
        addr[1],
        server_hostname="localhost",
        cert_reqs=ssl.CERT_REQUIRED,
        ca_certs=ca,
        timeout=8,
    )
    try:
        connection.connect()
        assert connection.sock is not None
    finally:
        connection.close()
        server.wait()


def test_bracketed_address_literal_is_accepted(tmp_path):
    cert, key = make_certificate(
        "localhost", dns_names=["localhost"], ip_addresses=["::1"]
    )
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key, host="::1")
    addr = server.start()
    sock = connect(addr)
    wrapped = None
    try:
        wrapped = ssw.ssl_wrap_socket_with_ocsp(
            sock=sock,
            server_hostname="[::1]",
            ssl_context=None,
            ca_certs=ca,
        )
        assert wrapped is not None
    finally:
        if wrapped is not None:
            wrapped.close()
        sock.close()
        server.wait()


def test_scoped_address_literal_is_accepted(tmp_path):
    cert, key = make_certificate(
        "localhost", dns_names=["localhost"], ip_addresses=["::1"]
    )
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key, host="::1")
    addr = server.start()
    sock = connect(addr)
    wrapped = None
    try:
        wrapped = ssw.ssl_wrap_socket_with_ocsp(
            sock=sock,
            server_hostname="::1%lo",
            ssl_context=None,
            ca_certs=ca,
        )
        assert wrapped is not None
    finally:
        if wrapped is not None:
            wrapped.close()
        sock.close()
        server.wait()
