"""Security tests: schema-supplied Python names must never become generated source code.

Every case drives the real CLI on a temporary schema and asserts that the run is refused
cleanly and that nothing was written.  Only the standard library is used here; no product
code is imported, so a hardened implementation cannot disturb the bookkeeping.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

MARKER = "DMCG_INJECTED_MARKER"


def _payload(style: str) -> str:
    """Return a value that would start a new statement in a generated import line."""
    if style == "newline":
        return f"system\n{MARKER} = 1"
    if style == "semicolon":
        return f"system;{MARKER} = 1"
    raise AssertionError(style)


def _run(tmp_path: Path, schema: dict, extra_args: tuple[str, ...] = ()) -> tuple[subprocess.CompletedProcess, Path]:
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
    return proc, output_path


def _assert_refused(proc: subprocess.CompletedProcess, output_path: Path) -> None:
    combined = proc.stdout + proc.stderr
    assert "Traceback (most recent call last)" not in combined, (
        "the generator crashed instead of refusing the schema:\n" + combined[-2000:]
    )
    assert proc.returncode != 0, (
        "generation succeeded on a schema the security property forbids; "
        "the schema-supplied value was accepted"
    )
    assert not output_path.exists(), "an output file was written for a refused schema"
    assert MARKER not in proc.stdout, "the schema-supplied statement appeared in generated output"


PAYLOAD_STYLES = ["newline", "semicolon"]


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_reference_import_declaration_is_refused(tmp_path: Path, style: str) -> None:
    schema = {
        "type": "object",
        "properties": {"payload": {"$ref": "#/$defs/Payload"}},
        "$defs": {"Payload": {"x-python-import": {"module": "os", "name": _payload(style)}}},
    }
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_property_custom_type_path_is_refused(tmp_path: Path, style: str) -> None:
    schema = {"type": "object", "properties": {"payload": {"customTypePath": f"os.{_payload(style)}"}}}
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_root_custom_type_path_is_refused(tmp_path: Path, style: str) -> None:
    schema = {"customTypePath": f"os.{_payload(style)}"}
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_nested_type_annotation_import_is_refused(tmp_path: Path, style: str) -> None:
    schema = {
        "type": "object",
        "properties": {"payload": {"type": "string", "x-python-type": "Callable[[Payload], str]"}},
        "$defs": {"Payload": {"x-python-import": {"module": "os", "name": _payload(style)}}},
    }
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_schema_base_path_string_is_refused(tmp_path: Path, style: str) -> None:
    schema = {
        "title": "Item",
        "type": "object",
        "customBasePath": f"os.{_payload(style)}",
        "properties": {"name": {"type": "string"}},
    }
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_schema_base_path_list_is_refused(tmp_path: Path, style: str) -> None:
    schema = {
        "title": "Item",
        "type": "object",
        "customBasePath": ["mixins.AuditMixin", f"os.{_payload(style)}"],
        "properties": {"name": {"type": "string"}},
    }
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_inline_import_declaration_is_refused(tmp_path: Path, style: str) -> None:
    schema = {
        "type": "object",
        "properties": {"payload": {"type": "string", "x-python-import": {"module": "os", "name": _payload(style)}}},
    }
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)


@pytest.mark.parametrize("style", PAYLOAD_STYLES)
def test_schema_extra_imports_are_refused(tmp_path: Path, style: str) -> None:
    schema = {
        "type": "object",
        "x-additional-imports": [f"os.{_payload(style)}"],
        "properties": {"name": {"type": "string"}},
    }
    proc, output_path = _run(tmp_path, schema)
    _assert_refused(proc, output_path)
