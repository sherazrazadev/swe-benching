"""The standalone storage implementation must also keep a name inside its namespace."""

from unittest.mock import Mock

import pytest

from lfx.services.storage.local import LocalStorageService

pytestmark = pytest.mark.asyncio


async def test_standalone_storage_contains_names(tmp_path):
    settings = Mock()
    settings.settings.config_dir = str(tmp_path)
    service = LocalStorageService(Mock(), settings)

    await service.save_file(flow_id="mine", file_name="keep.txt", data=b"KEEP")
    (tmp_path / "other").mkdir()
    (tmp_path / "other" / "secret.txt").write_bytes(b"OTHER-NAMESPACE-MARKER")

    with pytest.raises(Exception):  # noqa: B017 - any refusal is acceptable
        await service.get_file(flow_id="mine", file_name="../other/secret.txt")

    # Positive control: an ordinary own-namespace round trip still works.
    await service.save_file(flow_id="mine", file_name="réport final ü.txt", data=b"MINE")
    assert await service.get_file(flow_id="mine", file_name="réport final ü.txt") == b"MINE"
