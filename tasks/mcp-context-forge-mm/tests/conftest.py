"""Harness for the hidden suites.

The application is exercised through its real HTTP entry points with FastAPI's
TestClient. The database is a private temporary SQLite file; authentication and
permission checks are stubbed per permission, the way the real service answers
per resource and verb. Bookkeeping (names, expected values, clean-up) is computed
here with the standard library only, never with product helpers.
"""

from __future__ import annotations

import html
import os
import tempfile
import uuid
from unittest.mock import AsyncMock

import pytest

# The application decides at import time which optional routers to mount and which
# database URL to use. Set everything before the first product import.
os.environ.update(
    {
        "MCPGATEWAY_ADMIN_API_ENABLED": "true",
        "MCPGATEWAY_UI_ENABLED": "true",
        "LLMCHAT_ENABLED": "false",
        "DB": "sqlite",
        "DATABASE_URL": "sqlite:///:memory:",
        "TEST_DATABASE_URL": "sqlite:///:memory:",
        "AUTH_REQUIRED": "false",
        "MCP_CLIENT_AUTH_ENABLED": "false",
        "MCPGATEWAY_REQUIRE_AUTH": "false",
        "JWT_SECRET_KEY": "hidden-suite-jwt-secret-key-with-minimum-32-bytes",
        "AUTH_ENCRYPTION_SECRET": "hidden-suite-encryption-secret-32-bytes",
        "BASIC_AUTH_USER": "tester",
        "BASIC_AUTH_PASSWORD": "tester-password",
        "RELOAD": "false",
    }
)

# A value that only appears when the gateway stringifies its own Python objects.
RUNTIME_MARKER = "of type object at 0x"

# What the stubbed permission service grants. The app asks per permission name, the
# way the real RBAC service answers per resource and verb.
GRANTED_PERMISSIONS = {
    "prompts.create",
    "prompts.read",
    "prompts.update",
    "prompts.delete",
    "resources.create",
    "resources.read",
    "resources.update",
    "resources.delete",
    "gateways.create",
    "gateways.read",
    "gateways.update",
    "admin.system_config",
    "admin.import",
}

ADMIN_USER = {
    "email": "hidden-admin@example.com",
    "username": "hidden-admin",
    "full_name": "Hidden Admin",
    "is_admin": True,
    "ip_address": "127.0.0.1",
    "user_agent": "hidden-suite",
}


@pytest.fixture(scope="session")
def app():
    """A live application bound to a private temporary SQLite database."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    import mcpgateway.db as db_mod
    from mcpgateway.config import settings

    fd, path = tempfile.mkstemp(suffix=".db")
    url = f"sqlite:///{path}"
    settings.database_url = url
    settings.auth_required = False
    settings.ssrf_allow_localhost = True

    engine = create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db_mod.engine = engine
    db_mod.SessionLocal = session_factory

    import mcpgateway.main as main_mod

    main_mod.SessionLocal = session_factory
    import mcpgateway.middleware.auth_middleware as auth_middleware_mod

    auth_middleware_mod.SessionLocal = session_factory
    db_mod.Base.metadata.create_all(bind=engine)

    # Authentication and per-permission authorisation are stubbed.
    from mcpgateway.auth import get_current_user
    from mcpgateway.middleware.rbac import get_current_user_with_permissions
    from mcpgateway.services.permission_service import PermissionService

    main_mod.app.dependency_overrides[get_current_user] = lambda credentials=None, db=None: dict(ADMIN_USER)

    def _permission_user(request=None, credentials=None, jwt_token=None):
        return dict(ADMIN_USER)

    main_mod.app.dependency_overrides[get_current_user_with_permissions] = _permission_user

    original_check = PermissionService.check_permission

    async def _check_permission(self, user_email, permission, *args, **kwargs):
        return permission in GRANTED_PERMISSIONS

    PermissionService.check_permission = _check_permission
    try:
        yield main_mod.app
    finally:
        PermissionService.check_permission = original_check
        main_mod.app.dependency_overrides.clear()
        engine.dispose()
        os.close(fd)
        os.unlink(path)


@pytest.fixture(scope="session")
def client(app):
    from fastapi.testclient import TestClient

    return TestClient(app)


# --------------------------------------------------------------------------- helpers


def create_prompt(client, template, name=None, arguments=None):
    """Create a prompt through the public API and return the response."""
    name = name or f"hidden-prompt-{uuid.uuid4().hex[:12]}"
    payload = {
        "prompt": {
            "name": name,
            "description": "hidden suite prompt",
            "template": template,
            "arguments": arguments or [],
        },
        "team_id": None,
        "visibility": "public",
    }
    return client.post("/prompts/", json=payload)


def render_prompt(client, name, arguments=None):
    """Ask the gateway to render a prompt (REST route)."""
    return client.post(f"/prompts/{name}", json=arguments or {})


def render_prompt_rpc(client, name, arguments=None):
    """Ask the gateway to render a prompt over JSON-RPC."""
    return client.post(
        "/rpc",
        json={"jsonrpc": "2.0", "id": 1, "method": "prompts/get", "params": {"name": name, "arguments": arguments or {}}},
    )


def create_text_resource(client, content, uri=None, name=None):
    """Create a text resource through the public API and return the response."""
    uri = uri or f"res://hidden/{uuid.uuid4().hex[:12]}"
    payload = {
        "resource": {
            "uri": uri,
            "name": name or f"hidden-resource-{uuid.uuid4().hex[:8]}",
            "description": "hidden suite resource",
            "mime_type": "text/plain",
            "content": content,
        },
        "team_id": None,
        "visibility": "public",
    }
    return client.post("/resources/", json=payload)


def read_resource(client, resource_id):
    return client.get(f"/resources/{resource_id}")


def import_preview(client, prompts):
    data = {
        "version": "2025-03-26",
        "exported_at": "2026-01-01T00:00:00Z",
        "entities": {"prompts": prompts},
    }
    return client.post("/admin/import/preview", json={"data": data})


def register_upstream_gateway(client, monkeypatch, upstream_prompts):
    """Register a gateway whose upstream server offers the given prompts.

    The upstream MCP session is stubbed; the gateway registration itself goes through
    the real HTTP route and the real federation code path.
    """
    import mcpgateway.main as main_mod

    gateway_name = f"hidden-upstream-{uuid.uuid4().hex[:10]}"
    monkeypatch.setattr(
        main_mod.gateway_service,
        "_initialize_gateway",
        AsyncMock(return_value=({"prompts": {"listChanged": False}}, [], [], upstream_prompts)),
    )
    monkeypatch.setattr(main_mod.gateway_service, "_notify_gateway_added", AsyncMock())
    body = {
        "name": gateway_name,
        "url": f"http://127.0.0.1:9/{uuid.uuid4().hex[:10]}/sse",
        "description": "hidden suite upstream",
        "transport": "SSE",
    }
    return client.post("/gateways/", json=body), gateway_name


def stored_prompt_name(client, original_name):
    """Return the name the gateway stored a prompt under, looking it up in the listing."""
    response = client.get("/prompts/")
    assert response.status_code == 200, response.text
    for prompt in response.json():
        if prompt.get("originalName") == original_name:
            return prompt["name"]
    raise AssertionError(f"prompt {original_name!r} was not stored")


# --------------------------------------------------------------------------- assertions


def assert_refused(response, marker=RUNTIME_MARKER):
    """The attack was refused by a client error and no runtime value came back."""
    body = html.unescape(response.text)
    assert marker not in body, f"the response exposed Python runtime internals: {body[:400]}"
    assert 400 <= response.status_code < 500, f"expected a client error, got {response.status_code}: {response.text[:400]}"


def assert_rpc_refused(response, marker=RUNTIME_MARKER):
    """The JSON-RPC call answered with an error object and no runtime value."""
    body = html.unescape(response.text)
    assert marker not in body, f"the response exposed Python runtime internals: {body[:400]}"
    payload = response.json()
    assert isinstance(payload, dict) and "error" in payload, f"expected a JSON-RPC error, got {payload}"
