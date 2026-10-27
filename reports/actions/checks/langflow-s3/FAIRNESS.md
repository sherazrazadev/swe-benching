# Fairness & leniency review — langflow-s3

Properties (instruction.md, quoted above the table):
- **A1** "No response the server returns may expose file content, file names, or flow or project identifiers that belong to an account other than the caller's."
- **A2** "Where a request is scoped to part of the caller's own material, only that part may be returned."
- **C** "No identifier or file name passed in may make the product reach, create, or change a stored file outside the container that identifier names; anything read must come from inside it."
- **K** "Everything that works today keeps working."

## 1. Per-test fairness

| test (file::name) | what it asserts | instruction basis | could a correct fix fail? | risk |
|---|---|---|---|---|
| security/test_mcp_foreign_flow_read.py::test_foreign_flow_read_is_refused | global MCP read of another account's flow file returns nothing; own file still reads | A1 | no | low |
| security/test_mcp_foreign_second_file_read.py::test_second_foreign_file_read_is_refused | same for a second flow/file | A1 | no | low |
| security/test_mcp_foreign_read_after_listing.py::test_foreign_read_after_listing_is_refused | a URI taken from the listing (or the direct foreign URI if listing is scoped) still refuses | A1 | no — falls back when listings are scoped | low |
| security/test_mcp_encoded_separator_read.py::test_encoded_separator_cannot_escape_namespace | `../<foreign flow>/<file>` encoded in the last segment from the caller's own namespace refuses | C | no — decode-then-check or storage containment both pass | low |
| security/test_mcp_foreign_bucket_read.py::test_foreign_bucket_read_is_refused | another account's account-level file refuses; own bucket reads | A1, K | no — an all-bucket refusal fails the own-bucket control | low |
| security/test_lfx_storage_containment.py::test_standalone_storage_contains_names | lfx `get_file("mine","../other/secret.txt")` raises; unicode round trip works | C (name passed into the product's public storage API) | no under the literal C; a handler-only guard would fail | medium |
| security/test_backend_storage_containment.py::test_storage_contains_names | backend `get_file` and `get_file_stream` refuse traversal; round trip works | C | no | low |
| security/test_mcp_resources_listing_scope.py::test_resources_listing_is_scoped_to_caller | no foreign flow id in URIs; own file name listed | A1 (flow id/file names in a response), K | no | low |
| security/test_mcp_tools_listing_scope.py::test_tools_listing_is_scoped_to_caller | no foreign flow's tool; own flow's tool present | A1 (foreign flow exposed as a handle), K | no — reading the tool name as the flow's exposed identifier is a slight stretch | low |
| security/test_mcp_cross_project_read.py::test_cross_project_read_is_refused | project server refuses caller's own flow outside the project; in-project read works | A2, K | no | low |
| security/test_mcp_project_account_level_read.py::test_account_level_file_is_refused_on_project_server | project server refuses caller's own account-level file; in-project read works | A2, K | no | low |
| security/test_stored_path_foreign_flow.py::test_stored_path_of_foreign_flow_is_refused | preview of a foreign flow-namespaced path yields no secret; own flow preview 200 | A1, K | no — `>=400 or no content` | low |
| security/test_stored_path_foreign_bucket.py::test_stored_path_of_foreign_bucket_is_refused | same for a foreign account bucket; own bucket and bare name work | A1, K | no | low |
| security/test_copy_destination_containment.py::test_destination_outside_namespace_is_refused_without_side_effect | escaping destination gets `>=400` and creates nothing in the other container | C; Contracts define refusal | maybe → no: a silent basename clamp creates nothing outside but returns 201; the primary mechanism (validate and refuse) passes | medium |
| functional/test_own_files_readable.py::test_own_namespaces_remain_readable | own flow and bucket files readable via MCP | K | no | low |
| functional/test_stored_path_own_readable.py::test_own_stored_paths_still_preview | own bucket/flow preview and bare name 200 | K | no | low |
| functional/test_own_listings.py::test_own_items_remain_listed | own flows/files visible to both accounts | K | no | low |
| functional/test_storage_roundtrip.py::test_storage_operations_roundtrip | save/get/size/stream/list/delete, plain and unicode names | K | no | low |
| functional/test_lfx_storage_roundtrip.py::test_standalone_storage_roundtrip | lfx round trip | K | no | low |
| functional/test_project_server_reads.py::test_project_scope_keeps_working | project read, listing and tools | K, A2 | no | low |
| functional/test_copy_own_works.py::test_own_file_can_be_copied_and_read | own copy 201, downloadable, original intact | K | no | low |
| functional/project/test_local_storage_service.py::test_initialization | ready, data_dir set | K | no | low |
| functional/project/test_local_storage_service.py::test_build_full_path | path contains flow/file and ends with the name | K | no | low |
| functional/project/test_local_storage_service.py::test_resolve_component_path | resolved under data_dir | K | no | low |
| functional/project/test_local_storage_service.py::test_resolve_component_path_malformed | returned as-is | K | no | low |
| functional/project/test_local_storage_service.py::test_save_and_get_file | round trip | K | no | low |
| functional/project/test_local_storage_service.py::test_save_file_creates_directory | directory created | K | no | low |
| functional/project/test_local_storage_service.py::test_save_file_overwrites_existing | overwrite | K | no | low |
| functional/project/test_local_storage_service.py::test_get_file_not_found | FileNotFoundError with "not found" | K | no | low |
| functional/project/test_local_storage_service.py::test_save_binary_file | binary round trip | K | no | low |
| functional/project/test_local_storage_service.py::test_list_files_empty_directory | `[]` | K | no | low |
| functional/project/test_local_storage_service.py::test_list_files_with_files | three names | K | no | low |
| functional/project/test_local_storage_service.py::test_list_files_with_numeric_flow_id | int flow id accepted | K | no | low |
| functional/project/test_local_storage_service.py::test_list_files_async_iteration | three names | K | no | low |
| functional/project/test_local_storage_service.py::test_list_files_excludes_directories | `save_file("dir_test/subdir","nested.txt")` works; root listing excludes it | K (today's documented behaviour) | maybe → no: also rejecting separators in `flow_id` fails it; the test is the visible product contract | low |
| functional/project/test_local_storage_service.py::test_delete_existing_file | delete, then get raises | K | no | low |
| functional/project/test_local_storage_service.py::test_delete_nonexistent_file | no raise | K | no | low |
| functional/project/test_local_storage_service.py::test_delete_multiple_files | all deleted | K | no | low |
| functional/project/test_local_storage_service.py::test_get_file_size | size 100 | K | no | low |
| functional/project/test_local_storage_service.py::test_get_file_size_empty_file | 0 | K | no | low |
| functional/project/test_local_storage_service.py::test_get_file_size_nonexistent | FileNotFoundError | K | no | low |
| functional/project/test_local_storage_service.py::test_get_file_size_large_file | 1 MB | K | no | low |
| functional/project/test_local_storage_service.py::test_teardown | no raise | K | no | low |
| functional/project/test_local_storage_service.py::test_save_file_with_special_characters | round trip | K | no | low |
| functional/project/test_local_storage_service.py::test_save_file_with_unicode_content | round trip | K | no | low |
| functional/project/test_local_storage_service.py::test_concurrent_file_operations | 10 concurrent saves | K | no | low |
| functional/project/test_local_storage_service.py::test_concurrent_write_then_read | 50 concurrent write/read | K | no | low |
| functional/project/test_mcp_utils.py::test_handle_list_resources_includes_flow_and_user_files | mocked session; flow and user-file URIs listed | K | maybe → no: a Python-side `flow.user_id` filter fails the SimpleNamespace fake; the natural SQL scoping passes and the test is visible | medium |
| functional/project/test_mcp_utils.py::test_handle_list_tools_skips_blocked_custom_flows | blocked custom flow filtered; `tools == []` with no user context | K | maybe → no: a fix that raises on missing user context fails; returning `[]` (today's behaviour) passes | medium |

## 2. Verdict (gate a)

READY. Every security test follows from A1, A2 or C read literally; every functional test from K; no test names a route. Refusals accept any exception or any `>=400`, the harness is the real ASGI app, and oracle, blind, pass-alt and pass-hardening all score 1.0. The copy row's "maybe" is resolved no under the primary-mechanism rule: validate-and-refuse is the mechanism the Contracts describe, and any `>=400` is accepted; a silent basename clamp is an alternative, not the stated fix. The storage rows read C's "identifier or file name passed in" as covering the product's public storage API; a handler-only guard leaves that product path open.

### Required: generalize

- "the account's ordinary file API serves them too" → state the property over every access path.
- "Files can belong to a flow or directly to an account" / "including files that belong directly to the account rather than to a flow" → "the caller's own material, in every form the product stores it".
- "a resource URI whose first path segment is one of account A's flow identifiers and whose second segment is a file name" → "a resource naming another account's stored file".
- "The ordinary HTTP download of the same file is refused" → "the equivalent request through another path is refused".
- "Resource URIs keep their current download shape" → "resource addressing keeps its current form".
- "names with spaces or non-ASCII characters" → "names the product accepts today".

### Quality to tighten

- Leniency, caught: T1 "namespace exists" → sf-miss-flowowner (foreign-flow test); T2 "flow namespaces only" → sf-miss-bucket (foreign-bucket); T3 "backend only" → sf-miss-lfx; T4 "save already checked" → sf-miss-storage; T5 "metadata is not content" → sf-miss-listings (both listing tests); T6 "the wrapper delegates" → sf-miss-project (both project tests); S1 "trust the uploaded path" → sf-miss-preview (both stored-path tests); S2 "the source row is authorised" → sf-miss-copy.
- Leniency, uncaught: a check rejecting only `..` still allows an absolute name (`/etc/passwd`) — add a separator-only case to both storage tests; a route-only destination check leaves `storage.copy_file` raw — test it directly; the lfx test drives only `get_file` — add stream/delete; a project-server `resources/list` can still return account-level files — assert absence.
- Hints: title "MCP file access…" → "File access…"; "The example above is one example, not the full set of affected inputs or callers" → "Fix the problem."; drop "ordinary", "download shape".
- Realism: traps are plausible maintainer code; S1/S2 are injected but ordinary; T3 is exercised only through the class's public API, not an HTTP/MCP route — real code, noted, not flagged.

Human review: confirm the copy test should require `>=400` rather than accept a clamped-but-contained copy, and that the two visible pristine mocks (FakeFlow without `user_id`; `list_tools` with no user context) are acceptable constraints.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
