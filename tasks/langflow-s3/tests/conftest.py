"""Environment for the hidden MCP authorization tests.

Set before any product import so the app uses a private, throw-away database and
config directory (the verifier runs offline, as the unprivileged agent user).
"""

import os
import tempfile

_ROOT = tempfile.mkdtemp(prefix="lf-htests-")
os.environ["LANGFLOW_DATABASE_URL"] = f"sqlite:///{_ROOT}/langflow.db"
os.environ["LANGFLOW_CONFIG_DIR"] = f"{_ROOT}/config"
os.environ["LANGFLOW_AUTO_LOGIN"] = "false"
os.environ["LANGFLOW_DEACTIVATE_TRACING"] = "true"
os.environ["LANGFLOW_DO_NOT_TRACK"] = "true"
os.environ["LANGFLOW_LOAD_FLOWS_PATH"] = ""
os.environ["LANGFLOW_SAVE_DB_IN_CONFIG_DIR"] = "false"
