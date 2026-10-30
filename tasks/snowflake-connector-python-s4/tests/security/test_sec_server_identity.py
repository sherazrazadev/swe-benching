"""The peer certificate must cover the server name the connection asked for."""
from __future__ import annotations

import ssl

import pytest

from support.tlsutil import LocalTLSServer, ca_file, connect, make_certificate

import snowflake.connector.network  # noqa: F401  installs the connector TLS wrap
import snowflake.connector.ssl_wrap_socket as ssw
from snowflake.connector.vendored.urllib3.connection import HTTPSConnection


def _https_connection(addr, server_hostname, cert_reqs, ca):
    return HTTPSConnection(
        "127.0.0.1",
        addr[1],
        server_hostname=server_hostname,
        cert_reqs=cert_reqs,
        ca_certs=ca,
        timeout=8,
    )


def test_tls_wrap_refuses_certificate_for_another_name(tmp_path):
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key)
    addr = server.start()
    sock = connect(addr)
    try:
        with pytest.raises(Exception):
            ssw.ssl_wrap_socket_with_ocsp(
                sock=sock,
                server_hostname="other.example",
                ssl_context=None,
                ca_certs=ca,
            )
    finally:
        sock.close()
        server.wait()
    assert server.received_application_data is False


def test_https_connection_refuses_certificate_for_another_name(tmp_path):
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key)
    addr = server.start()
    connection = _https_connection(addr, "other.example", ssl.CERT_REQUIRED, ca)
    try:
        with pytest.raises(Exception):
            connection.connect()
    finally:
        connection.close()
        server.wait()
    assert server.received_application_data is False


def test_missing_server_name_is_refused_when_verification_required(tmp_path):
    cert, key = make_certificate("localhost", dns_names=["localhost"])
    ca = ca_file(tmp_path, cert)
    source = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    server = LocalTLSServer(cert, key)
    addr = server.start()
    sock = connect(addr)
    try:
        with pytest.raises(Exception):
            ssw.ssl_wrap_socket_with_ocsp(
                sock=sock,
                server_hostname=None,
                ssl_context=source,
                ca_certs=ca,
            )
    finally:
        sock.close()
        server.wait()


def test_certificate_that_does_not_cover_the_name_is_refused(tmp_path):
    # The common name is the requested host, but the certificate's
    # subjectAltName covers a different server.  A name comparison that looks
    # at the common name only would accept it.
    cert, key = make_certificate("localhost", dns_names=["attacker.example"])
    ca = ca_file(tmp_path, cert)
    server = LocalTLSServer(cert, key)
    addr = server.start()
    sock = connect(addr)
    try:
        with pytest.raises(Exception):
            ssw.ssl_wrap_socket_with_ocsp(
                sock=sock,
                server_hostname="localhost",
                ssl_context=None,
                ca_certs=ca,
            )
    finally:
        sock.close()
        server.wait()
