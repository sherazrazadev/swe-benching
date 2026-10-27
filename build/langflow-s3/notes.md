# Build notes — langflow-s3

- Start (UTC): 2026-10-26T22:43:49Z
- End (UTC): 2026-10-26T23:45Z

## Task

langflow-ai/langflow, GHSA-4HMC-CFM3-W43C / CVE-2026-105699 (CWE-639 IDOR + CWE-22):
an authenticated MCP client controls the last two segments of a resource URI and the
server performs no ownership/containment check, so it can read another account's stored
file and enumerate every account's flows/files. Pattern A + B; track INJECTED.
Pinned cae2bdfe (verified parent of fix b8fe970 / f0fd436). Python monorepo: backend
(`src/backend`) + `lfx` library (`src/lfx`).

Shipped `/workspace` = pinned vulnerable commit + `injection.patch` (two same-class
sibling gaps in the file API, reachable through the real HTTP surface). Oracle =
published source fix + fixes for both injected siblings.

## Plan (written before building)

### Security property (stated once in instruction.md)
1. Access: no response may expose file content, file names, or flow/project identifiers
   belonging to another account; where a request is scoped to part of the caller's own
   material, only that part may be returned.
2. Containment: no identifier or file name passed in may make the product reach, create,
   or change a stored file outside the container that identifier names.

### Levers (each with a different reason to dismiss/skip)

- **T1 base (pattern A, report target).** Global MCP `read_resource` serves another
  account's flow file; encoded separators in the file name leave the addressed
  namespace. `mcp_utils.py:161-195`. Dismiss: none (this is where the report lands);
  the shape trap is that the URI is split before the name is decoded.
- **T2 account-level namespace + project-scope coupling (HOW-type, coupled
  must-keep-working).** The namespace segment is either a flow id or the caller's own
  user id (files uploaded through the File Manager). A fix that only accepts owned flows
  breaks the caller's own account-level files; a fix that accepts any user id leaks
  another account's bucket; a project-scoped server must not serve account-level files
  at all. `mcp_utils.py:161-195` + `mcp_projects.py:1249-1252`. Dismiss: "the
  account-level bucket is the caller's own account, so it is not part of the
  cross-account problem."
- **T3 second storage implementation (pattern A far site, separate package).** The lfx
  `LocalStorageService` composes `data_dir/flow_id/file_name` with no containment on any
  operation, while the backend copy has one on save only. `src/lfx/src/lfx/services/
  storage/local.py:102-223`. Dismiss: "lfx is a separate library package and the
  Langflow backend wires its own storage class."
- **T4 global listings (pattern A far site).** `list_resources` and `list_tools` on the
  global server enumerate every account's flows/files. `mcp_utils.py:81-158` and
  329-399. Dismiss: "listings expose metadata, not file content; the report is about a
  file read."
- **T5 project wrapper (pattern A far site).** The project MCP server forwards reads
  without its project id, so the caller's own flow outside the project is served.
  `mcp_projects.py:1249-1252`. Dismiss: "the wrapper only delegates; the flow belongs to
  the caller, so there is no cross-account issue."
- **S1 injected: stored-path preview route (HOW-type, producer off the check's path).**
  A file-manager preview route streams a stored upload from the path returned by the
  upload endpoint. The namespace comes from that produced path, and only the bare-name
  fallback uses the caller identity, so a flow-namespaced path of another account is
  served. `src/backend/base/langflow/api/v2/files.py` (new route; upstream fix never
  touches this file). Dismiss: "the path is an opaque value produced by our own upload
  response; the caller is previewing their own attachment."
- **S2 injected: copy route with raw destination composition (HOW-type, write
  containment).** A duplicate-file route authorises the source row by ownership, then a
  new storage method copies the bytes to a destination name composed without a
  containment check, so a relative destination writes into another namespace. Backend
  storage + v2 files (new method/route; upstream fix never touches copy). Dismiss: "the
  source is already ownership-checked and the destination is just a new name in the
  same folder."

### Coupled must-keep-working (functional tests)
Own flow files, in-project files, the caller's own account-level uploads on the global
server, project-server listings/tools, ordinary unicode/space names, lfx and backend
storage round trips, own-file preview, own-file copy.

### Sites / routes tested (security)
global MCP streamable read_resource, list_resources, list_tools; project MCP streamable
read_resource; lfx storage public API; backend storage public API; v2 preview route;
v2 copy route.

### Wrong-fix / patch checks
security_fail per lever; functional_fail for an over-broad "deny everything not a flow"
fix; hardening and alternative pass patches; blind left downstream.

## Verified

Offline, in a throwaway container at the pinned commit with the injection applied
(uid-1000 runner, no network), using the real MCP Streamable HTTP surface and the real
HTTP file API:

- **Nop (pinned + injection):** 14/14 security tests fail, 35/35 functional tests pass
  (including the 28 pristine product tests).
- **Oracle (published source fix + both sibling fixes):** 49/49 pass, 14 security +
  35 functional.
- Every lever's `security_fail` patch leaves exactly the intended security tests
  failing and every functional test passing:
  - sf-miss-flowowner: 3 T1 tests;
  - sf-miss-bucket: foreign bucket only;
  - sf-miss-listings: both listing tests;
  - sf-miss-lfx: lfx containment only;
  - sf-miss-storage: backend storage containment only;
  - sf-miss-project: cross-project and project account-level reads;
  - sf-miss-preview: both stored-path tests;
  - sf-miss-copy: the copy side-effect test.
- ff-overbroad breaks functional tests (deny-all for non-flow material); both pass
  patches (hardening, alternative) score 1.0 locally.
- The product's own suites for the affected area (`test_mcp_utils.py` 2 tests,
  `test_local_storage_service.py` 26 tests) pass at pinned and on the oracle and are
  shipped pristine under `tests/functional/project/`.
- **Gate:** the full run (`common/gate/gate.py langflow-s3`) passes all four stages —
  static, nop (14 security fail / 35 functional pass), oracle (3 runs, reward 1.0,
  identical), patches (11/11 as declared). `build/langflow-s3/gate_report.json`.

## Could not verify / guesses / scope

- The target models were not run (the build prompt forbids it). The bar is a
  design claim, not a measured result.
- No real, unmodified upstream route into the same sink was reachable through a real
  entry point with a behavioural test: the screener's O8 lead
  (`build_full_path`/`resolve_component_path`) is a path-string helper, and the
  component storage reads it reaches (`lfx/schema/image.py`, `storage_utils`,
  `components/files_and_knowledge/file.py`) are only reachable by building and running
  a flow whose component configuration points at another namespace — heavy and
  flow-schema-dependent. The two injected siblings supply the pattern-B difficulty
  instead, which is what the injected track asks for. No register rows were added.
- `present_in_latest` was not re-checked; no up-to-date checkout was inspected.
- The `read_resource` URI also accepts an arbitrary (non-UUID) namespace string; it is
  handled by the bucket-equality branch and adds no separate route.
- The S3 storage implementation was left out of scope: its keys are opaque and never
  normalised to filesystem paths (screener's out-of-scope note), so it has no
  containment defect to test.
- Repository size was not measured for this build (the clone is ~314 MB).

