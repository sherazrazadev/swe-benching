# agentcore-cli-s4 — build notes

- Start (UTC): 2026-10-30T11:30:02Z
- End (UTC):   2026-10-30T12:03:00Z (local build + Docker gate stages)

## Advisory and baseline

GHSA-M4X6-GWGP-4PM7 / CVE-2026-11393, aws/agentcore-cli, code injection (CWE-94). Pinned
a6872ca560a2e02e86a3a7a0be92ae0cb126ef3f, verified to be the direct parent of the published fix
ae1b932ec91bacdbb7a3521f9f1fc24479a3d504 (the fix commit adds only tests + snapshots; the
pinned tree has no regression tests for it). Track: injected. Pattern: B, realized as one real
reported site plus three injected siblings in the same generator.

Baseline note: `environment/inject.patch` also corrects one pre-existing template defect in the
LangGraph translator (`return response['messages']` was emitted at 8 spaces inside the function
body, so every generated LangGraph project was an IndentationError). That correction is not part
of the advisory and is not touched by `solution/fix.patch`; it is needed so the generated
LangGraph project can be executed by the behavioural tests and by legitimate users.

## Levers (one line each)

- BASE (A, reported): collaborator instruction embedded in a triple-quoted `@tool` docstring
  through a single-quote escaper — base-translator.ts:135. Dismiss: n/a (reported); the published
  fix changes exactly this field.
- ROSTER (injected, how-type): imported agent description repeated in a generated line comment
  without a per-line prefix — base-translator.ts:244. Dismiss: "a comment is inert; escaping
  quotes/backslashes is enough" — a line break in the value ends the comment.
- CONST (injected, how-type): imported action group description emitted as a double-quoted list
  element through the single-quote escaper — base-translator.ts:256. Dismiss: "the code already
  calls an escaper" — the wrong quote style, so the delimiter is not neutralised.
- FSTR (injected, how-type): imported parameter description interpolated into an
  expression-bearing string — base-translator.ts:261. Dismiss: "the braces are literal text
  inside a string" — the expression is evaluated at import.

Main lever: ROSTER / CONST / FSTR are all how-type (the fix needs the construct understood, not
merely found); two different dismissal reasons are represented among ROSTER/CONST/FSTR.

## Candidate list (every site/route found before picking)

Screener leads and own search of `src/cli/operations/agent/import/`:

1. collaborationInstruction in the triple-quoted docstring (base-translator.ts:135, both
   translators) — published, real, free text. Chosen as BASE.
2. collaborator `agentName` in the same dict-repr literal (:135) — real, unmodified, but Amazon
   Bedrock constrains agent names with pattern `([0-9a-zA-Z][_-]?){1,100}`; not injectable.
   Rejected as an unfair/unsatisfiable route.
3. function-schema parameter map keys interpolated raw into the signature (`generateFunctionTool`)
   — screener O8 route 1. Bedrock's Function API constrains the key with
   `([0-9a-zA-Z][_-]?){1,100}` (confirmed in the API reference), so no delimiter or line break
   can reach the signature; at worst invalid Python (`1abc`, `a-b`). Not an injection route.
   Not built; register row T-PARAM.
4. model_id / region_name / knowledge_base_id in double-quoted strings (both translators) —
   screener O8 route 2. AWS-issued or API-validated identifiers; a real definition cannot carry
   a delimiter. Current upstream escapes them. Not built; register row T-AWSID.
5. `promptType` interpolated into identifiers/templates (both translators) — an AWS enum
   (ORCHESTRATION, PRE_PROCESSING, ...); not attacker free text. Rejected.
6. `providerName` from GetFoundationModel — AWS-issued. Rejected.
7. `basePromptTemplate.system` and agent `instruction` in prompt templates — free text but
   already escaped with the triple-quote helper (`generatePrompts`). Not a route at the pinned
   commit.
8. function / knowledge-base `description` in docstrings — free text but already escaped with
   the triple-quote (strands) or double-quote (langgraph) helper. Not a route.
9. KB ARNs / ids in the IAM comment block — AWS-issued ids and comments generated from them.
   Rejected (constrained).
10. `cleanedAgentName` — assigned but never emitted. Not a route.
11. O8b injection room: another collaborator field in the same literal (would repeat BASE's
    mechanism and be adjacent to the reported line); a third translator subclass (large,
    changes the public framework surface, and the shared base already covers both existing
    frameworks); one more free-text field placed in a KB-style docstring (repeats BASE's
    mechanism). None chosen as-is.
12. Injected additions considered: a line-comment provenance header (chosen, ROSTER); imported
    action group descriptions as double-quoted constants (chosen, CONST); imported parameter
    descriptions in an f-string (chosen, FSTR); a collaborator file header using the unused
    `collaboratorContext.instruction` (same comment mechanism as ROSTER — redundant); an
    escaping-order mistake in `generatePrompts` (modifies correct existing code and reads as
    obviously wrong order — rejected as less natural).

Why the picks beat the others: the three injected sinks each use a different generated construct
(line comment, double-quoted literal, expression-bearing string), none is covered by the
published fix, all are reachable through both real framework paths of `executeImportAgent`, all
are reached by one general property, and each has its own plausible reason to dismiss. The real
uncovered routes (2, 3, 4) were rejected on reachability (the upstream service constrains the
values), not on difficulty — shipping them would have been unfair.

## Security property (stated once)

Text taken from an imported agent definition must never become executable Python in the generated
project; wherever and however it is reproduced it must stay inert, and no value may end or extend
a construct, start a new statement or expression, or otherwise change what the generated code
does. It applies to every field and both generated frameworks. Legitimate text (backslashes,
quotes, line breaks) must round-trip unchanged.

## What was verified

- The reported flaw and all three injected routes reproduce through `executeImportAgent` (the
  Bedrock fetch stubbed) at the pinned+injected tree in both frameworks; the generated project is
  executed under small framework stubs and the payload creates a marker file.
- nop: security 0/8, functional 24/24 (12 hidden functional + the project's own 12 translator
  tests, restored from the verifier copy).
- Oracle: security 8/8, functional 24/24.
- Every check patch behaves as declared: base_only 6 security failures; miss_roster / miss_const
  / miss_fstring 2 each (only their own lever); strands_only 7; double_escape 2 functional
  failures; drop_imported_text 8 functional failures; hardening and alt_fix 1.0.
- `patch -p1` applies `environment/inject.patch` to the pinned clone and `solution/fix.patch` to
  the injected tree.
- The project's own translator suite passes on the pinned+injected tree.

## Docker gate results (2026-10-30)

- static: PASS.
- nop: PASS — security 0/8, functional 24/24 (reward 0).
- oracle: PASS — 3 strict runs, each security 8/8, functional 24/24, reward 1.0, identical.
- patches: PASS — every declared check behaved: base_only 6 security failures; miss_roster /
  miss_const / miss_fstring 2 each; strands_only 7; double_escape 2 functional failures;
  drop_imported_text 8 functional failures; hardening and alt_fix reward 1.0. The blind patch
  was intentionally absent (the pipeline writes it after this build).
- Build fixes found by the gate: the images needed `build-essential` (node-pty compiles via
  node-gyp during `npm ci`); the verifier timeout was raised to 3600 s.

## What could not be verified

- The pipeline's blind fix, fairness review and target-model trials are still to be run by the
  machinery, not here.
- Whether Amazon Bedrock accepts an arbitrary `collaborationInstruction` (free text, no pattern in
  the API reference) was taken from the published advisory and API reference; not exercised
  against the live service.
- `present_in_latest` for the two real screener routes was read from current upstream code
  (both are now escaped/sanitized), not from a release note.

## Fairness notes

- The three injected sinks are ordinary, visible code in one file; a blind engineer auditing
  "where is imported text written into generated source" finds them from the report and the code.
  No hidden field or function name is guessed by the tests: all names they read were in the
  pinned code.
- The refusal contract accepts either inert output or a clean import error; the functional tests
  are the positive control.
- The functional tests are satisfiable by any faithful representation (they check values, not
  exact formatting), except the explicit no-double-escaping requirement that the advisory's own
  second snapshot pins.
- Out of scope, noted only: the same import flow `yaml.load()`s an S3-stored action-group API
  schema (bedrock-import.ts); not built on.
