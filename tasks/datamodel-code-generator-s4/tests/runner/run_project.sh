#!/usr/bin/env bash
# Project's own tests for the affected area, restored from the pristine snapshot shipped in
# the verifier image. Run from the restored workspace with the project importable.
set -uo pipefail
OUT="$1"
cd /workspace || exit 1
export PYTHONPATH=/workspace/src:/workspace
# The project's own harness reads expected files through inline-snapshot; its CI mode is the
# supported mode for running the suite without snapshot updates (the pinned harness predates a
# later inline-snapshot API change that is only reached when the plugin is active).
export CI=1
exec python3 -m pytest \
  "tests/parser/test_jsonschema.py::test_resolve_type_import_from_defs" \
  "tests/parser/test_jsonschema.py::test_resolve_type_import_from_defs_not_found" \
  "tests/parser/test_jsonschema.py::test_resolve_type_import_from_defs_no_x_python_import" \
  "tests/main/jsonschema/test_main_jsonschema.py::test_main_jsonschema_custom_base_path" \
  "tests/main/jsonschema/test_main_jsonschema.py::test_main_jsonschema_custom_base_paths_list" \
  "tests/main/jsonschema/test_main_jsonschema.py::test_main_jsonschema_x_python_import_unused" \
  -q -p no:cacheprovider --junitxml="$OUT"
