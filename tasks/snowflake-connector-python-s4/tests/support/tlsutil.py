"""Offline loopback TLS helpers for the hidden TLS identity checks.

Certificates are generated at run time and every server listens on an
ephemeral loopback port, so nothing here needs the network.
"""
from __future__ import annotations

import ipaddress
import os
import socket
import ssl
import tempfile
import threading
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def make_certificate(common_name, dns_names=(), ip_addresses=()):
    """Return a self-signed (cert, key) naming the given DNS/IP identities."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc) - timedelta(minutes=5))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(hours=2))
    )
    entries = [x509.DNSName(name) for name in dns_names]
    entries += [x509.IPAddress(ipaddress.ip_address(addr)) for addr in ip_addresses]
    if entries:
        builder = builder.add_extension(
            x509.SubjectAlternativeName(entries), critical=False
        )
    return builder.sign(key, hashes.SHA256()), key


def pem_certificate(cert):
    return cert.public_bytes(serialization.Encoding.PEM)


def pem_private_key(key):
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )


def ca_file(tmp_path, cert, name="ca.pem"):
    """Write *cert* as a PEM trust anchor and return its path."""
    path = tmp_path / name
    path.write_bytes(pem_certificate(cert))
    return str(path)


def connect(addr, timeout=8):
    """Open a TCP connection to *addr*, picking the right address family."""
    family = socket.AF_INET6 if ":" in addr[0] else socket.AF_INET
    sock = socket.socket(family, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    sock.connect(addr)
    return sock


class LocalTLSServer:
    """A single-shot loopback TLS server presenting one certificate."""

    def __init__(
        self,
        cert,
        key,
        host="127.0.0.1",
        max_version=None,
        min_version=None,
    ):
        self.cert = cert
        self.key = key
        self.host = host
        self.max_version = max_version
        self.min_version = min_version
        self.received_application_data = False
        self.handshake_error = None
        self._addr = None
        self._ready = threading.Event()
        self._done = threading.Event()
        self._thread = None

    def start(self, timeout=10):
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()
        if not self._ready.wait(timeout):
            raise RuntimeError("local TLS server did not start")
        if self._addr is None:
            raise RuntimeError(f"local TLS server could not bind: {self._error}")
        return self._addr

    def wait(self, timeout=8):
        self._done.wait(timeout)

    def _serve(self):
        cert_file = key_file = None
        listener = None
        try:
            cert_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
            cert_file.write(pem_certificate(self.cert))
            cert_file.close()
            key_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
            key_file.write(pem_private_key(self.key))
            key_file.close()

            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            if self.min_version is not None:
                context.minimum_version = self.min_version
            if self.max_version is not None:
                context.maximum_version = self.max_version
            context.load_cert_chain(cert_file.name, key_file.name)

            family = socket.AF_INET6 if ":" in self.host else socket.AF_INET
            listener = socket.socket(family, socket.SOCK_STREAM)
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind((self.host, 0))
            listener.listen(1)
            listener.settimeout(10)
            self._addr = listener.getsockname()[:2]
            self._ready.set()

            try:
                conn, _ = listener.accept()
            except (socket.timeout, OSError):
                return
            try:
                conn.settimeout(10)
                try:
                    with context.wrap_socket(conn, server_side=True) as tls:
                        try:
                            if tls.recv(1):
                                self.received_application_data = True
                        except (ssl.SSLError, OSError):
                            pass
                except (ssl.SSLError, OSError) as exc:
                    self.handshake_error = exc
            finally:
                try:
                    conn.close()
                except OSError:
                    pass
        except Exception as exc:  # bind/setup failure surfaces through start()
            self._error = exc
            self._ready.set()
        finally:
            if listener is not None:
                try:
                    listener.close()
                except OSError:
                    pass
            for handle in (cert_file, key_file):
                if handle is not None:
                    try:
                        os.unlink(handle.name)
                    except OSError:
                        pass
            self._done.set()
