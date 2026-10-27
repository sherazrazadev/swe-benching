"""In-process harness for the gateway configuration and invocation entry points.

Everything runs in-process against a throwaway sqlite tracking store.  The
configuration APIs are exercised through the real Flask routes that the server
registers; gateway invocations go through the real FastAPI route.  A TCP
listener ("canary") records any connection a gateway call makes, so a test can
assert that no outbound request left the process.
"""

import json
import os
import socket
import sqlite3
import tempfile
import threading
import time
import uuid

_TMP = tempfile.mkdtemp(prefix="mlflow-gw-")
_DB = os.path.join(_TMP, "mlflow.db")
_URI = "sqlite:///" + _DB

os.environ["MLFLOW_TRACKING_URI"] = _URI
os.environ["_MLFLOW_SERVER_FILE_STORE"] = _URI
os.environ["_MLFLOW_SERVER_ARTIFACT_ROOT"] = "file://" + _TMP + "/artifacts"
os.environ.setdefault("MLFLOW_CRYPTO_KEK_PASSPHRASE", "task-passphrase")

import flask  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

import mlflow  # noqa: E402

mlflow.set_tracking_uri(_URI)

from mlflow.server import handlers  # noqa: E402
from mlflow.server.gateway_api import gateway_router  # noqa: E402

_api = flask.Flask("gateway-api")
for _path, _handler, _methods in handlers.get_endpoints():
    if "gateway" in _path:
        _api.add_url_rule(_path, _handler.__name__, _handler, methods=_methods)
_http = _api.test_client()

_gateway = FastAPI()
_gateway.include_router(gateway_router)
client = TestClient(_gateway, raise_server_exceptions=False)

SECRET_CREATE = "/api/3.0/mlflow/gateway/secrets/create"
SECRET_UPDATE = "/api/3.0/mlflow/gateway/secrets/update"
SECRET_GET = "/api/3.0/mlflow/gateway/secrets/get"
MODEL_CREATE = "/api/3.0/mlflow/gateway/model-definitions/create"
ENDPOINT_CREATE = "/api/3.0/mlflow/gateway/endpoints/create"
ENDPOINT_GET = "/api/3.0/mlflow/gateway/endpoints/get"


def unique(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def _json(response):
    try:
        return response.get_json()
    except Exception:
        return None


def create_secret(secret_name, secret_value=None, provider=None, auth_config=None):
    body = {
        "secret_name": secret_name,
        "secret_value": secret_value if secret_value is not None else {"api_key": "sk-test"},
    }
    if provider:
        body["provider"] = provider
    if auth_config is not None:
        body["auth_config"] = auth_config
    response = _http.post(SECRET_CREATE, json=body)
    return response.status_code, _json(response)


def update_secret(secret_id, secret_value=None, auth_config=None):
    body = {"secret_id": secret_id}
    if secret_value is not None:
        body["secret_value"] = secret_value
    if auth_config is not None:
        body["auth_config"] = auth_config
    response = _http.post(SECRET_UPDATE, json=body)
    return response.status_code, _json(response)


def get_secret(secret_id):
    response = _http.get(f"{SECRET_GET}?secret_id={secret_id}")
    return response.status_code, _json(response)


def list_secret_names():
    response = _http.get("/api/3.0/mlflow/gateway/secrets/list")
    data = _json(response)
    if response.status_code != 200 or not data:
        return set()
    return {secret.get("secret_name") for secret in data.get("secrets", [])}


def create_model_definition(name, secret_id, provider, model_name):
    response = _http.post(
        MODEL_CREATE,
        json={"name": name, "secret_id": secret_id, "provider": provider, "model_name": model_name},
    )
    return response.status_code, _json(response)


def create_endpoint(name, model_definition_id):
    response = _http.post(
        ENDPOINT_CREATE,
        json={
            "name": name,
            "model_configs": [
                {
                    "model_definition_id": model_definition_id,
                    "linkage_type": "PRIMARY",
                    "weight": 1.0,
                }
            ],
        },
    )
    return response.status_code, _json(response)


def get_endpoint(name):
    response = _http.get(f"{ENDPOINT_GET}?name={name}")
    return response.status_code, _json(response)


def invoke(name, payload=None):
    payload = payload or {"messages": [{"role": "user", "content": "hi"}]}
    return client.post("/gateway/mlflow/v1/chat/completions", json={"model": name, **payload})


def link_endpoint(name, secret_id, provider, model_name="m"):
    """Create a model definition from an existing secret and an endpoint from it."""
    status, data = create_model_definition(name + "-md", secret_id, provider, model_name)
    if status != 200:
        return status, None
    model_definition_id = data["model_definition"]["model_definition_id"]
    return create_endpoint(name + "-ep", model_definition_id)


def provision(name, provider, secret_value, auth_config, model_name="m"):
    """Create a secret, model definition and endpoint; return their statuses/ids."""
    status, data = create_secret(name, secret_value=secret_value, provider=provider,
                                 auth_config=auth_config)
    if status != 200:
        return status, None
    secret_id = data["secret"]["secret_id"]
    status, _ = link_endpoint(name, secret_id, provider, model_name)
    if status != 200:
        return status, None
    return 200, secret_id


def raw_sql_set_auth_config(secret_id, auth_config):
    """Write a stored configuration row directly, as a row written before a check would be."""
    connection = sqlite3.connect(_DB)
    try:
        connection.execute(
            "UPDATE secrets SET auth_config = ? WHERE secret_id = ?",
            (json.dumps(auth_config), secret_id),
        )
        connection.commit()
    finally:
        connection.close()


class FakeResponse:
    headers = {"Content-Type": "application/json"}

    def __init__(self, payload):
        self._payload = payload

    async def json(self):
        return self._payload

    def raise_for_status(self):
        return None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class FakeAiohttp:
    """Records the URL of every POST and answers with a valid chat completion."""

    CHAT = {
        "id": "fake",
        "object": "chat.completion",
        "created": 1,
        "model": "m",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "ok"},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }

    def __init__(self):
        self.urls = []

    def __call__(self, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def post(self, url, json=None, timeout=None):
        self.urls.append(url)
        return FakeResponse(self.CHAT)


class Canary:
    """TCP listener that records connections and answers plain-HTTP POSTs."""

    def __init__(self, port=0):
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        last_error = None
        for _ in range(50):
            try:
                self.sock.bind(("127.0.0.1", port))
                break
            except OSError as e:
                last_error = e
                time.sleep(0.1)
        else:
            raise last_error
        self.sock.listen(16)
        self.port = self.sock.getsockname()[1]
        self.hits = []
        self._stop = False
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self):
        while not self._stop:
            try:
                conn, _ = self.sock.accept()
            except OSError:
                return
            threading.Thread(target=self._handle, args=(conn,), daemon=True).start()

    def _handle(self, conn):
        try:
            conn.settimeout(2.0)
            data = b""
            while b"\r\n\r\n" not in data and len(data) < 65536:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
            if not data:
                return
            head = data.split(b"\r\n\r\n", 1)[0]
            line = head.split(b"\r\n", 1)[0].decode("latin-1", "replace")
            self.hits.append({"line": line, "tls": data[:1] == b"\x16"})
            if data[:1] == b"\x16":
                return  # TLS ClientHello: the connection alone is the signal
            length = 0
            for header in head.split(b"\r\n")[1:]:
                if header.lower().startswith(b"content-length:"):
                    length = int(header.split(b":", 1)[1].strip())
            body = data.split(b"\r\n\r\n", 1)[1]
            while len(body) < length:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                body += chunk
            payload = json.dumps(self.CHAT).encode()
            conn.sendall(
                b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                + str(len(payload)).encode()
                + b"\r\nConnection: close\r\n\r\n"
                + payload
            )
        except Exception:
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass

    CHAT = FakeAiohttp.CHAT

    def close(self):
        self._stop = True
        try:
            self.sock.close()
        except Exception:
            pass

    def count(self):
        return len(self.hits)
