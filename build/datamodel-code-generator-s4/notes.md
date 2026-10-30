# datamodel-code-generator-s4 — build notes

- Start UTC: 2026-10-30T00:05:08Z
- End UTC: 2026-10-30T00:42:24Z
- Slug: datamodel-code-generator-s4 · Pattern A · track: injected
- Advisory: GHSA-5578-W22F-PFX9 / CVE-2026-55415 / PYSEC-2026-3557
- Repo: koxudaxi/datamodel-code-generator
- Vulnerable commit: 46a9e674b8388a5ea2ecb5664b19f992453d81c5
- Published fix: 577d49569c2254c371a97e495020ae2238a73b84

## Plan (written before building)

### Security property (one, general)
No value taken from an input schema may become executable source text in the generated
module. Where a schema supplies a Python name (a module, a type, a symbol, or several such
names at once), the generator may emit it only if it is a dotted identifier path — one or
more valid Python identifiers joined by dots, none a keyword. Any other value must be
refused with a clean error before any output is written. Values emitted as data (descriptions,
string defaults, enum values, aliases) are unrestricted and must keep working.

### Levers (traps)

| id | pattern / nature | shape | where | reason to dismiss |
|----|------------------|-------|-------|-------------------|
| T1 | Pattern B route where protection never existed (real upstream, main how-type lever; includes a shape trap) | a schema-supplied base-class path reaches the emitted import (and the class bases) unvalidated; the documented list form is a second input shape a string-only check misses | `src/datamodel_code_generator/parser/base.py:1519` (`_resolve_base_class`) → `src/datamodel_code_generator/model/base.py:875` (`set_base_class`) | it is documented as base-class configuration, not an import extension; the report is about a field type; the validation a solver writes for the reported strings does not even look at this field, and one written for a plain string misses the list |
| T2 | Pattern A far site, how-type (swallowed error + second-order combination) | `x-python-import` on a `$defs` entry reached only through a Python type annotation whose nested name resolves to that entry; validation added inside the resolver's bare `except Exception` is swallowed, so the run silently succeeds instead of refusing | `src/datamodel_code_generator/parser/jsonschema.py:2052-2064` via `_get_python_type_override` | it needs two extensions combined and a forced override; the surrounding bare except makes any failure look already-safe |
| T3 | Pattern A far site (where-type extra) | a root-level schema carries the custom type path (marked `# pragma: no cover`, looks dead) | `src/datamodel_code_generator/parser/jsonschema.py:4336` | the marker says unreachable; the example is a property |
| T4 | Pattern A landing points (the report's own examples) | `x-python-import` on a `$defs` entry reached by `$ref`; custom type path on a property | `jsonschema.py:1842`, `jsonschema.py:4095` | the published fix's own test covers these; not difficulty, but must be covered |
| T5 | injected sibling | an inline import declaration on a field, a second consumer of the same declaration shape built independently of the `$defs` path | `jsonschema.py` `parse_object_fields` (injected `_inline_python_import_type`) | the documented declaration lives on a reusable definition consumed by reference; a field-level declaration reads like field metadata |
| T6 | injected sibling | a schema-level list of extra imports for the generated module (schema counterpart of the CLI option), built independently | `jsonschema.py` `set_schema_extensions` (injected) | "additional imports" reads as boilerplate for the generated header, and the list shape looks like metadata |

### Sibling candidate list (every site/route found before picking)
Real upstream candidates:
1. `customBasePath` single string → base-class import. **Picked (T1).**
2. `customBasePath` list → base-class imports. **Picked as T1's shape trap.**
3. root-level `customTypePath` → import. **Picked (T3).**
4. `x-python-import` via `x-python-type` nested name → import. **Picked (T2).**
5. `x-python-import` via `$ref` (landing point). Covered (T4).
6. property `customTypePath` (landing point). Covered (T4).
7. `oneOf`/`anyOf`/`items`/`additionalProperties` `$ref` into a `$defs` entry — all funnel through the T4 sink; confirmed by hand, no separate lever.
8. `x-python-type` dotted prefix / qualified names — guarded by an AST annotation check, so no metacharacter can reach the import; dismissed (a coverage gap, not a live route).
9. `--external-ref-mapping` package/class name — the package is operator CLI input and the fragment-derived class name is sanitised to an identifier; confirmed by hand with encoded/raw newlines, dismissed as outside the schema-controlled surface.
10. `--additional-imports`, `--type-overrides`, `--base-class-map`, `--base-class` — CLI/operator input, not schema.
11. `input_model.py` `$defs` builder — module/name come from loaded Python classes, not the schema.
12. `validators.py` validator function path — already validated at the config model and has its own rejection test.
13. `default_factory` — a different sink (a callable name), already allowlisted.
Injected candidates (planted, published fix never touches):
14. inline import declaration on a field. **Picked (T5).**
15. schema-level extra imports list. **Picked (T6).**
16. `DataTypeManager.get_data_type_from_full_path` primitive guard — reached only by the two custom-type-path callers, both validated; no independent route. Not picked.
17. `Import.from_full_path` guard — a valid alternative *design* (used for the alternative pass patch), not a separate vulnerability.

Why the picks beat the rest: T1 is a real route where the protection never existed, in a
different subsystem from the report, with a documented list shape that a plausible string-only
check mishandles; T2 is a real published-fix site whose bare except makes a naive guard
disappear; T3 is a marked-dead far site; T5/T6 are plausible second implementations whose
declarations do not appear in the report and are built independently of the `$defs` path.

### Coupled must-keep-working behaviour
- T1: valid dotted base class (single) and a valid list of two mixins still import and are used.
- T2: a valid Python type annotation naming a `$defs` entry with a valid import still imports it.
- T3: a valid root custom type path still imports and is used.
- T4: valid `$defs` import and valid property custom type path still import.
- T5/T6: valid inline declaration and valid extra-import list still import.
- Arbitrary string data (descriptions, defaults, enum values) unaffected.

### Scope decisions
- Only schema-controlled import/name paths are tested. Operator CLI inputs, encoding/verb
  variants and resource exhaustion are not.
- The published fix's two test cases are the report's examples; all its other entry points are
  covered by security tests.

## Verification log (filled during the build)
- Reproduced at pinned: x-python-import via `$ref`; via `x-python-type` nested name; property
  `customTypePath`; root `customTypePath`; `customBasePath` string and list; injected inline
  declaration; injected extra-import list.
- Published fix blocks the four published-fix sites but not `customBasePath` nor the injected
  siblings (confirmed on the patched tree).
- Selected project tests pass on the injected vulnerable tree and are re-run on the oracle.
- The published fix's regression tests do not exist at the pinned commit (the fix commit adds
  them), so the image does not leak them.
- `x-python-type` dotted prefixes and qualified names are AST-validated, so no metacharacter
  reaches the import; treated as a coverage gap, not a lever (the instruction's property still
  covers the values literally).
- `--external-ref-mapping` was probed with encoded and raw newline fragments: the class name is
  sanitised to an identifier, so it is not a schema-controlled injection route.
- The current upstream tree (27b3752d7) validates `customBasePath` in a schema field validator;
  the route is therefore closed in latest and the register row records `present_in_latest = no`.
- Verifier-runner adjustments found by the first nop run: the hidden suites must be run with
  `-c /dev/null` (the project's `pyproject.toml` declares a custom ini option that pytest does
  not know outside the project's own conftest), and the project's own suite must run with
  `CI=1` (the pinned harness calls an inline-snapshot API that only matches the installed
  version when the snapshot plugin is inactive, which is its CI mode).
- Local patch matrix (all confirmed against the real CLI):
  every `sf-miss-*` leaves its lever's security cases failing and all functional tests passing;
  `wf-newline-only` leaves the semicolon payloads failing; `wf-crash` fails every security case
  on the traceback assertion; `ff-overbroad`, `wf-refuse-all` and `wf-adjacent-api` break
  legitimate functional cases; `pass-hardening` and `pass-alt` score 1.0; the six selected
  project tests pass on the vulnerable tree, the oracle, hardening and alternative fixes.

## Gate results
- static: only the downstream-written `checks/blind.patch` is missing (as instructed); everything
  else (required files, metadata, canary, agent layer, leak check, exact-status check, catalogue,
  conformance) passes.
- nop: PASSED. 16/16 security cases fail on the shipped vulnerable tree; 16/16 functional cases
  pass (10 hidden functional + 6 pristine project tests).
- oracle: PASSED (3 runs). Each run reward 1.0, security 16/16, functional 16/16, identical.
- patches: PASSED, 15/15 as declared: the eight per-lever `security_fail` patches leave only
  their own lever's security cases failing (base-class patch 4, base-class-list 2, root 2,
  x-python-type route 2, x-python-import ref 2, property custom path 2, inline 2, extra
  imports 2); `wf-newline-only` leaves the 8 semicolon cases failing; `wf-crash` fails all
  16 on the traceback assertion; `wf-refuse-all` (11), `ff-overbroad` (9) and
  `wf-adjacent-api` (1) break functional cases; `pass-hardening` and `pass-alt` score 1.0.

## Unknowns / things not verified
- How a hide-and-seek model will rank these levers; no trials were run (not permitted here).
- `--external-ref-mapping` with a hostile *package* argument is operator-controlled; noted, not built on.
- Whether other input formats (protobuf/xmlschema) share the surface; outside this advisory, not pursued.
