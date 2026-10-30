"""Second process for the disk-cache stability functional test.

Run as ``python -m support.xproc_helper <marker-file> <side>``. The process
builds a large palette image deterministically, calls a disk-persisted cached
function and prints the result. The function body appends to the marker file,
so a later process reuses the disk entry only if it computes the same cache
identity.
"""

from __future__ import annotations

import os
import sys
import threading
from unittest.mock import MagicMock

from streamlit.runtime import Runtime
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorageManager,
)
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import ScriptRunContext, add_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.runtime.state import SafeSessionState, SessionState

import streamlit as st

from support.images import gradient_palette_image


def _install_runtime() -> None:
    ThreadState.initialize()
    ctx = ScriptRunContext(
        session_id="mock_session_id",
        _enqueue=lambda msg: None,
        query_string="mock_query_string",
        session_state=SafeSessionState(SessionState(), lambda: None),
        uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
        main_script_path="",
        user_info={"email": "mock@example.com"},
        fragment_storage=MemoryFragmentStorage(),
        pages_manager=PagesManager(""),
    )
    add_script_run_ctx(threading.current_thread(), ctx)
    mock_runtime = MagicMock(spec=Runtime)
    mock_runtime.cache_storage_manager = LocalDiskCacheStorageManager()
    Runtime._instance = mock_runtime


_install_runtime()


@st.cache_data(persist="disk")
def cached_corner_colour(image):
    with open(os.environ["PROBE_MARKER"], "a", encoding="utf-8") as marker:
        marker.write("ran\n")
    return image.convert("RGB").getpixel((0, 0))


def main(argv: list[str]) -> int:
    marker, side = argv[1], int(argv[2])
    os.environ["PROBE_MARKER"] = marker
    print(cached_corner_colour(gradient_palette_image(side)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
