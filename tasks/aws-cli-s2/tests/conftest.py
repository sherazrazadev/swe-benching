"""Shared helpers for the hidden security and functional suites.

Every command is driven through the real ``aws`` entry point in a subprocess,
with a clean environment and a private HOME.  The AWS services it talks to are
answered by a loopback HTTP server started for the test session; nothing leaves
the machine.  Credentials written by the CLI are recognised only by harmless
markers, and every check is done with the standard library.
"""
from __future__ import annotations

import base64
import json
import os
import shutil
import stat
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

# ---------------------------------------------------------------------------
# Harmless markers that stand in for credential material.
# ---------------------------------------------------------------------------
SEED_BYTES = b"seed-bytes-2f8c1d"
PNG_BYTES = b"png-bytes-77aa03"
DB_TOKEN_SECRET = "AuthTokenMarker"

_IAM_XML = {
    "CreateVirtualMFADevice": lambda p: (
        '<CreateVirtualMFADeviceResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">'
        '<CreateVirtualMFADeviceResult><VirtualMFADevice>'
        '<SerialNumber>arn:aws:iam::123456789012:mfa/'
        + p.get("VirtualMFADeviceName", ["mfa"])[0]
        + "</SerialNumber>"
        "<Base32StringSeed>"
        + base64.b64encode(SEED_BYTES).decode()
        + "</Base32StringSeed>"
        "<QRCodePNG>"
        + base64.b64encode(PNG_BYTES).decode()
        + "</QRCodePNG>"
        "</VirtualMFADevice></CreateVirtualMFADeviceResult>"
        "<ResponseMetadata><RequestId>1</RequestId></ResponseMetadata>"
        "</CreateVirtualMFADeviceResponse>"
    ),
    "CreateUser": lambda p: (
        '<CreateUserResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">'
        "<CreateUserResult><User><Path>/AWS/CodeDeploy/</Path><UserName>"
        + p.get("UserName", ["u"])[0]
        + "</UserName><Arn>arn:aws:iam::123456789012:user/"
        + p.get("UserName", ["u"])[0]
        + "</Arn><UserId>AIDAEXAMPLE</UserId></User></CreateUserResult>"
        "<ResponseMetadata><RequestId>1</RequestId></ResponseMetadata>"
        "</CreateUserResponse>"
    ),
    "CreateAccessKey": lambda p: (
        '<CreateAccessKeyResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">'
        "<CreateAccessKeyResult><AccessKey><UserName>"
        + p.get("UserName", ["u"])[0]
        + "</UserName><AccessKeyId>AKIAEXAMPLEKEY</AccessKeyId>"
        "<Status>Active</Status>"
        "<SecretAccessKey>SECRET-ACCESS-KEY-MARKER</SecretAccessKey>"
        "</AccessKey></CreateAccessKeyResult>"
        "<ResponseMetadata><RequestId>1</RequestId></ResponseMetadata>"
        "</CreateAccessKeyResponse>"
    ),
    "PutUserPolicy": lambda p: (
        '<PutUserPolicyResponse xmlns="https://iam.amazonaws.com/doc/2010-05-08/">'
        "<ResponseMetadata><RequestId>1</RequestId></ResponseMetadata>"
        "</PutUserPolicyResponse>"
    ),
}


def _auth_token():
    # The CLI carries the authorization token through unchanged.
    return base64.b64encode(b"aws:AuthTokenMarker").decode()


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # keep the test output readable
        pass

    def _send(self, body, ctype, code=200):
        raw = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _json(self, obj):
        self._send(json.dumps(obj), "application/x-amz-json-1.1")

    def do_GET(self):
        path = urlparse(self.path).path
        if path.endswith("/endpoint") or "/endpoint/" in path:
            fmt = parse_qs(urlparse(self.path).query).get("format", ["pypi"])[0]
            self._json({
                "repositoryEndpoint":
                    "https://dom-1234.d.codeartifact.us-east-1.amazonaws.com/%s/repo/"
                    % fmt,
            })
            return
        self._json({})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length)
        target = self.headers.get("X-Amz-Target", "")
        if target:
            operation = target.split(".")[-1]
            if operation == "GetAuthorizationToken":
                self._json({"authorizationToken": _auth_token(),
                            "expiration": 1900000000})
                return
            self._json({})
            return
        if "authorization-token" in self.path:
            self._json({"authorizationToken": _auth_token(),
                        "expiration": 1900000000})
            return
        params = parse_qs(raw.decode() or "")
        action = params.get("Action", ["Unknown"])[0]
        factory = _IAM_XML.get(action)
        body = factory(params) if factory else (
            "<Response><ResponseMetadata><RequestId>1</RequestId>"
            "</ResponseMetadata></Response>"
        )
        self._send(body, "text/xml")


@pytest.fixture(scope="session")
def endpoint():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield "http://127.0.0.1:%d" % server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()


# ---------------------------------------------------------------------------
# Command helpers
# ---------------------------------------------------------------------------
_AWS = None


def aws_binary():
    global _AWS
    if _AWS is None:
        _AWS = shutil.which("aws") or shutil.which(
            "aws", path=os.path.dirname(sys.executable)
        )
    assert _AWS, "aws console script not found"
    return _AWS


def clean_env(home, endpoint_url, extra=None):
    """A minimal, deterministic environment for one CLI invocation."""
    env = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(home),
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TZ": "UTC",
        "AWS_ACCESS_KEY_ID": "AKIATESTKEY",
        "AWS_SECRET_ACCESS_KEY": "test-secret-key",
        "AWS_DEFAULT_REGION": "us-east-1",
        "AWS_ENDPOINT_URL": endpoint_url,
        "AWS_EC2_METADATA_DISABLED": "true",
        "AWS_PAGER": "",
    }
    env.update(extra or {})
    return env


def run_aws(home, endpoint_url, *args, cwd=None, extra_env=None, stdin=None,
            timeout=120):
    return subprocess.run(
        [aws_binary(), *args],
        cwd=str(cwd) if cwd else str(home),
        env=clean_env(home, endpoint_url, extra_env),
        input=stdin,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def mode_of(path):
    return stat.S_IMODE(os.stat(path).st_mode)


def assert_owner_only(path):
    """No group or other access: the file is readable only by its owner."""
    bits = mode_of(path) & 0o077
    assert bits == 0, "file %s is accessible to group/other: %o" % (
        path, mode_of(path)
    )


def write_file(path, data, mode):
    path = os.fspath(path)
    if isinstance(data, bytes):
        with open(path, "wb") as handle:
            handle.write(data)
    else:
        with open(path, "w") as handle:
            handle.write(data)
    os.chmod(path, mode)


def read_text(path):
    with open(os.fspath(path), "r") as handle:
        return handle.read()


def read_bytes(path):
    with open(os.fspath(path), "rb") as handle:
        return handle.read()


def make_swift_stub(tmp_path):
    """A ``swift`` that succeeds; only the file write is under test."""
    bindir = os.path.join(str(tmp_path), "bin")
    os.makedirs(bindir, exist_ok=True)
    path = os.path.join(bindir, "swift")
    with open(path, "w") as handle:
        handle.write("#!/bin/sh\nexit 0\n")
    os.chmod(path, 0o755)
    return bindir
