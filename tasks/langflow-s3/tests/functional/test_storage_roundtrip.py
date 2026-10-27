"""Ordinary storage operations keep working for every file operation."""

import pytest

from langflow.services.deps import get_storage_service

from support.harness import world

pytestmark = pytest.mark.asyncio


async def test_storage_operations_roundtrip():
    async with world() as w:
        storage = get_storage_service()
        flow_id = w.ids["flow_inside"]
        for name in ("report-final.txt", "réport final ü.txt"):
            await storage.save_file(flow_id=flow_id, file_name=name, data=b"payload")
            assert await storage.get_file(flow_id=flow_id, file_name=name) == b"payload"
            assert await storage.get_file_size(flow_id=flow_id, file_name=name) == len(b"payload")
            streamed = b""
            async for chunk in storage.get_file_stream(flow_id=flow_id, file_name=name):
                streamed += chunk
            assert streamed == b"payload"
            assert name in await storage.list_files(flow_id=flow_id)
            await storage.delete_file(flow_id=flow_id, file_name=name)
            assert name not in await storage.list_files(flow_id=flow_id)
