"""Shared harness: boots the real Langflow app, seeds two accounts, stores files,
and connects MCP clients through the app's HTTP (ASGI) surface.
"""

from __future__ import annotations

import base64
import os
import tempfile
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from urllib.parse import quote

from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient, Timeout

from langflow.main import create_app
from langflow.services.deps import get_auth_service, get_db_service, session_scope
from langflow.services.database.models.api_key.model import ApiKey
from langflow.services.database.models.folder.model import Folder
from langflow.services.database.models.flow.model import Flow
from langflow.services.database.models.user.model import User
from lfx.services.manager import get_service_manager
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from pydantic import AnyUrl
from sqlmodel import select

OWNER = "owner"
CALLER = "caller"
PASSWORD = "hc-bench-password"  # noqa: S105
OWNER_SECRET = b"OWNER-SECRET-MARKER"
OWNER_SECOND = b"OWNER-SECOND-MARKER"
OWNER_BUCKET = b"OWNER-BUCKET-MARKER"
CALLER_INSIDE = b"CALLER-INSIDE-MARKER"
CALLER_OUTSIDE = b"CALLER-OUTSIDE-MARKER"
CALLER_OWN = b"CALLER-OWN-MARKER"
CALLER_BUCKET = b"CALLER-BUCKET-MARKER"

APP = None


def _client_factory(headers=None, timeout=None, auth=None):
    return AsyncClient(
        transport=ASGITransport(app=APP),
        base_url="http://testserver",
        headers=headers,
        timeout=timeout or Timeout(30, read=300),
    )


@dataclass
class World:
    app: object
    http: AsyncClient
    ids: dict = field(default_factory=dict)
    paths: dict = field(default_factory=dict)
    keys: dict = field(default_factory=dict)
    root: str = ""

    def download_uri(self, path: str) -> str:
        namespace, name = path.split("/", 1)
        return f"http://localhost:7860/api/v1/files/download/{namespace}/{quote(name)}"

    def encoded_traversal_uri(self, namespace: str, target_path: str) -> str:
        # A relative name whose separators are percent-encoded in the URI.
        return (
            "http://localhost:7860/api/v1/files/download/"
            f"{namespace}/{quote('../' + target_path, safe='')}"
        )

    def headers(self, who: str) -> dict:
        return {"x-api-key": self.keys[who]}

    async def preview(self, who: str, path: str):
        """Ask the ordinary file API to stream a stored path."""
        return await self.http.get(
            "api/v2/files/preview",
            headers=self.headers(who),
            params={"path": path},
        )

    async def copy(self, who: str, file_id: str, name: str):
        """Ask the ordinary file API to duplicate one of the caller's files."""
        return await self.http.post(
            f"api/v2/files/{file_id}/copy",
            headers=self.headers(who),
            params={"name": name},
        )

    def mcp_url(self, path: str) -> str:
        return f"http://testserver{path}"

    @asynccontextmanager
    async def session(self, path: str, who: str):
        async with streamablehttp_client(
            self.mcp_url(path), headers=self.headers(who), httpx_client_factory=_client_factory, timeout=30
        ) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                yield session


async def _seed(world: World) -> None:
    async with session_scope() as session:
        users = {}
        for name in (OWNER, CALLER):
            user = User(
                username=name,
                password=get_auth_service().get_password_hash(PASSWORD),
                is_active=True,
                is_superuser=False,
            )
            session.add(user)
            await session.flush()
            await session.refresh(user)
            users[name] = user
            world.ids[name] = str(user.id)
            key = f"hc-key-{name}"
            session.add(
                ApiKey(
                    name=name,
                    user_id=user.id,
                    api_key=key,
                    hashed_api_key=get_auth_service().get_password_hash(key),
                )
            )
            world.keys[name] = key
        project = Folder(name="caller-project", user_id=users[CALLER].id)
        session.add(project)
        await session.flush()
        await session.refresh(project)
        world.ids["project"] = str(project.id)
        for key, name, folder in (
            ("flow_inside", "caller-inside-flow", project.id),
            ("flow_outside", "caller-outside-flow", None),
            ("flow_owner", "owner-flow", None),
            ("flow_owner2", "owner-second-flow", None),
        ):
            flow = Flow(
                name=name,
                user_id=users[OWNER if key in ("flow_owner", "flow_owner2") else CALLER].id,
                folder_id=folder,
                data={"nodes": [], "edges": []},
                mcp_enabled=True,
            )
            session.add(flow)
            await session.flush()
            await session.refresh(flow)
            world.ids[key] = str(flow.id)
        await session.commit()

    # Store files through the product's own upload paths.
    async def upload(who: str, flow_key: str, name: str, content: bytes) -> str:
        response = await world.http.post(
            f"api/v1/files/upload/{world.ids[flow_key]}",
            headers=world.headers(who),
            files={"file": (name, content, "text/plain")},
        )
        assert response.status_code == 201, response.text
        return response.json()["file_path"]

    world.paths["owner_file"] = await upload(OWNER, "flow_owner", "owner-secret.txt", OWNER_SECRET)
    world.paths["owner_file2"] = await upload(OWNER, "flow_owner2", "owner-second.txt", OWNER_SECOND)
    world.paths["inside_file"] = await upload(CALLER, "flow_inside", "inside.txt", CALLER_INSIDE)
    world.paths["outside_file"] = await upload(CALLER, "flow_outside", "outside.txt", CALLER_OUTSIDE)
    world.paths["own_file"] = await upload(CALLER, "flow_inside", "own note ü.txt", CALLER_OWN)

    response = await world.http.post(
        "api/v2/files",
        headers=world.headers(CALLER),
        files={"file": ("bucket note ü.txt", CALLER_BUCKET, "text/plain")},
    )
    assert response.status_code == 201, response.text
    world.paths["bucket_file"] = response.json()["path"]
    world.ids["bucket_file_id"] = response.json()["id"]

    response = await world.http.post(
        "api/v2/files",
        headers=world.headers(OWNER),
        files={"file": ("owner bucket note.txt", OWNER_BUCKET, "text/plain")},
    )
    assert response.status_code == 201, response.text
    world.paths["owner_bucket_file"] = response.json()["path"]
    world.ids["owner_bucket_file_id"] = response.json()["id"]


@asynccontextmanager
async def world():
    global APP
    root = tempfile.mkdtemp(prefix="lf-world-")
    db_url = f"sqlite:///{root}/langflow.db"
    os.environ["LANGFLOW_DATABASE_URL"] = db_url
    os.environ["LANGFLOW_CONFIG_DIR"] = f"{root}/config"
    get_service_manager().factories.clear()
    get_service_manager().services.clear()
    app = create_app()
    db_service = get_db_service()
    db_service.database_url = db_url
    db_service.reload_engine()
    async with LifespanManager(app, startup_timeout=None, shutdown_timeout=60) as manager:
        APP = manager.app
        async with AsyncClient(
            transport=ASGITransport(app=manager.app),
            base_url="http://testserver/",
            timeout=Timeout(60, read=300),
        ) as http:
            w = World(app=manager.app, http=http, root=root)
            await _seed(w)
            yield w
    APP = None


async def read_decoded(session: ClientSession, uri: str) -> bytes:
    result = await session.read_resource(AnyUrl(uri))
    blob = result.contents[0].blob
    if isinstance(blob, str):
        blob = blob.encode()
    # The server returns base64 bytes; the protocol carries them base64-encoded.
    return base64.b64decode(base64.b64decode(blob))


async def attempt_read(session: ClientSession, uri: str):
    """Return (returned, payload). returned=False means the call was refused."""
    try:
        return True, await read_decoded(session, uri)
    except Exception as exc:  # noqa: BLE001 - any protocol error is a refusal here
        return False, str(exc)


def resource_uris(resources) -> list[str]:
    return [str(item.uri) for item in resources.resources]


def tool_names(tools) -> list[str]:
    return [item.name for item in tools.tools]
