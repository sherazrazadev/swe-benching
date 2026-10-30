"""Functional tests: legitimate schema-supplied names and arbitrary data keep working.

Each case drives the real CLI and checks the generated module still contains the import and
the type the schema asked for.  Standard library only.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest


def _run(tmp_path: Path, schema: dict, extra_args: tuple[str, ...] = ()) -> tuple[subprocess.CompletedProcess, str]:
    input_path = tmp_path / "schema.json"
    output_path = tmp_path / "models.py"
    input_path.write_text(json.dumps(schema), encoding="utf-8")
    proc = subprocess.run(  # noqa: S603
        [
            sys.executable,
            "-m",
            "datamodel_code_generator",
            "--input",
            str(input_path),
            "--input-file-type",
            "jsonschema",
            "--output",
            str(output_path),
            *extra_args,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    text = output_path.read_text(encoding="utf-8") if output_path.exists() else ""
    return proc, text


def _assert_generated(proc: subprocess.CompletedProcess, text: str) -> None:
    assert proc.returncode == 0, "legitimate schema was refused:\n" + (proc.stdout + proc.stderr)[-2000:]
    assert "Traceback (most recent call last)" not in (proc.stdout + proc.stderr)
    assert text, "no module was generated"


def test_schema_base_path_string(tmp_path: Path) -> None:
    schema = {
        "title": "User",
        "type": "object",
        "customBasePath": "myapp.models.UserBase",
        "properties": {"name": {"type": "string"}},
    }
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from myapp.models import UserBase" in text
    assert "class User(UserBase):" in text


def test_schema_base_path_list_of_mixins(tmp_path: Path) -> None:
    schema = {
        "title": "User",
        "type": "object",
        "customBasePath": ["mixins.AuditMixin", "mixins.TimestampMixin"],
        "properties": {"name": {"type": "string"}},
    }
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from mixins import AuditMixin, TimestampMixin" in text
    assert "class User(AuditMixin, TimestampMixin):" in text


def test_property_custom_type_path(tmp_path: Path) -> None:
    schema = {"type": "object", "properties": {"node": {"customTypePath": "mymodule.node.Node"}}}
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from mymodule.node import Node" in text


def test_root_custom_type_path(tmp_path: Path) -> None:
    schema = {"customTypePath": "mymodule.node.Node"}
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from mymodule.node import Node" in text
    assert "Node" in text.split("class Model", 1)[-1]


def test_reference_import_declaration(tmp_path: Path) -> None:
    schema = {
        "type": "object",
        "properties": {"status": {"$ref": "#/$defs/Status"}},
        "$defs": {"Status": {"x-python-import": {"module": "myapp.enums", "name": "Status"}}},
    }
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from myapp.enums import Status" in text


def test_nested_type_annotation_import(tmp_path: Path) -> None:
    schema = {
        "type": "object",
        "properties": {"callback": {"type": "string", "x-python-type": "Callable[[Status], str]"}},
        "$defs": {"Status": {"x-python-import": {"module": "myapp.enums", "name": "Status"}}},
    }
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from myapp.enums import Status" in text
    assert "from collections.abc import Callable" in text


def test_inline_import_declaration(tmp_path: Path) -> None:
    schema = {
        "type": "object",
        "properties": {"when": {"type": "string", "x-python-import": {"module": "datetime", "name": "datetime"}}},
    }
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from datetime import datetime" in text


def test_schema_extra_imports(tmp_path: Path) -> None:
    schema = {
        "type": "object",
        "x-additional-imports": ["datetime.date"],
        "properties": {"name": {"type": "string"}},
    }
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "from datetime import date" in text


def test_arbitrary_string_data_is_preserved(tmp_path: Path) -> None:
    schema = {
        "title": "Record",
        "type": "object",
        "description": 'A record; it says "hello" and\nspans lines.',
        "properties": {
            "name": {"type": "string", "default": "a;b#c", "description": "field; with \"quotes\""},
            "kind": {"type": "string", "enum": ["one;two", "three#four"]},
        },
    }
    proc, text = _run(tmp_path, schema)
    _assert_generated(proc, text)
    assert "class Record" in text
    assert "a;b#c" in text
    assert "one;two" in text


def test_cli_additional_imports_bare_module(tmp_path: Path) -> None:
    schema = {"title": "Item", "type": "object", "properties": {"name": {"type": "string"}}}
    proc, text = _run(tmp_path, schema, ("--additional-imports", "datetime"))
    _assert_generated(proc, text)
    assert "import datetime" in text
