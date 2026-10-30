"""Drive the public Streamlit caching API from a test process.

The tests call the same decorators an application uses; nothing here
reimplements caching. A script-run context and an in-memory cache storage
manager are installed the same way the project's own cache tests do it.
"""

from __future__ import annotations

import threading
from unittest.mock import MagicMock

import streamlit as st
from streamlit.runtime import Runtime
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import ScriptRunContext, add_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.runtime.state import SafeSessionState, SessionState

from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)

_INSTALLED = False


def install() -> None:
    """Install a script-run context and a memory cache storage, once per process."""
    global _INSTALLED
    if _INSTALLED:
        return

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
    mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
    Runtime._instance = mock_runtime
    _INSTALLED = True


def reset() -> None:
    """Drop every cached value between tests."""
    st.cache_data.clear()
    st.cache_resource.clear()


def rendered_colour(image) -> tuple[int, int, int]:
    """The colour an image displays at its top-left corner.

    Computed with Pillow, not with product code, so a hardened product helper
    cannot change what the test expects.
    """
    return image.convert("RGB").getpixel((0, 0))
