"""The standalone storage implementation keeps working for ordinary names."""

from unittest.mock import Mock

import pytest

from lfx.services.storage.local import LocalStorageService

pytestmark = pytest.mark.asyncio


async def test_standalone_storage_roundtrip(tmp_path):
    settings = Mock()
    settings.settings.config_dir = str(tmp_path)
    service = LocalStorageService(Mock(), settings)

    for name in ("report-final.txt", "réport final ü.txt"):
        await service.save_file(flow_id="mine", file_name=name, data=b"payload")
        assert await service.get_file(flow_id="mine", file_name=name) == b"payload"
        assert await service.get_file_size(flow_id="mine", file_name=name) == len(b"payload")
        assert name in await service.list_files(flow_id="mine")
        await service.delete_file(flow_id="mine", file_name=name)
        assert name not in await service.list_files(flow_id="mine")
