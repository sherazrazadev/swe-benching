# schema-org-s2 build notes

Start (UTC): 2026-10-28T03:40:37Z
End (UTC): 2026-10-28T04:06:00Z (all four gate stages finished; the last stage finished at 04:05:00Z)

Task: one security-fix benchmark task for GHSA-HWMC-R6MF-JH83 (spatie/schema-org, CWE-79),
pinned at 8833f42996208e50488e6547e7102166c0331dd9, published fix
be389b4759214c11cc1364a16e34a929c5af5a88. Pattern A+B, injected track.

## Levers (one line each)

- T1 (main, B: route where the protection never existed) — the tag option is interpolated into the
  emitted element's attribute with no escaping, so a quote ends the start tag; the encoder flag that
  protects the JSON body does nothing here. Reason to dismiss: a server-side CSP token, not schema
  content. src/BaseType.php:150-158, src/Graph.php:1198-1206, src/MultiTypedEntity.php:1085-1093 and
  the same code in the three generator templates.
- T2 (A: the published fix's far site, a second implementation) — generator/templates/static/BaseType.php,
  generator/templates/twig/Graph.php.twig and .../MultiTypedEntity.php.twig are the real source of the
  checked-in classes; the published fix patched them, but they look like dev-only tooling. Checked
  behaviourally by regenerating the package into a throw-away directory.
- T3 (A, injected: a second implementation) — src/ReferencedType.php and its static generator template
  hand-build a reference script block around the identifier instead of delegating; the wrapper is
  assumed to follow the base renderer, and the block contains no encoder call to search for.
- T4 (coupled must-keep-working) — toArray()/json_encode() must stay raw, so escaping at the value
  layer (the MiMo over-hardening shape) breaks every JSON-LD consumer; checked by the functional group
  and the project's own tests.

The security property is stated once, over the emitted element and the parsed values, not over any
route. All four levers fall under it as written.

## Candidate list and why the picks won

Every candidate found by reading the code (screener O8/O8b plus the search):

1. src/BaseType.php nonceAttr — picked (T1).
2. src/Graph.php nonceAttr — picked (T1).
3. src/MultiTypedEntity.php nonceAttr — picked (T1).
4. The same nonceAttr in generator/templates/static/BaseType.php, twig/Graph.php.twig,
   twig/MultiTypedEntity.php.twig — picked (part of T1, exercised by T2's regeneration).
5. src/ReferencedType.php toScript delegation — picked and re-shaped (T3): made it build its own
   block so the reported sink fix cannot reach it.
6. generator/templates/static/ReferencedType.php — picked (T3 copy).
7. The three encoder copies in the generator templates — picked (T2), the published fix's far site.
8. A fourth generated class with its own toScript (screener O8b #3) — rejected: it needs an invented
   public class and a template the project never had, so it reads as planted; T2 already exercises the
   generator path with real code.
9. A shared attribute-escaping helper used by nonceAttr (screener O8b #2) — rejected as a separate
   lever: every plausible variant (ENT_NOQUOTES, escaping only angle brackets) is the same attribute
   context as T1, so it would duplicate one concept rather than add a different reason to dismiss.
10. Graph context (constructor value) — not a lever: it lands in the JSON body and the body encoder
    covers it; kept only as an input shape in the security group.
11. toArray()/jsonSerialize() escapes — the coupled functional lever (T4), not a security route.
12. Graph::serializeNode / getNodes, MultiTypedEntity::serializeNode — internal array building; they
    feed the same encoders and add no second sink.
13. Schema.php factory, the Type interface, __toString/jsonSerialize overrides — no separate sink.
14. json_encode in README/tests — not product code.

## What was verified

- The flaw reproduces at pinned+injection through BaseType, Graph, MultiTypedEntity and ReferencedType
  (manual renders and the security group). No crafting steps are recorded here; the tests hold them.
- The project's own suite passes on pinned+injection: 1901 passed (30349 assertions).
- Security group: 21 tests, all fail on the vulnerable tree, all pass with solution/fix.patch.
- Functional group: 79 tests (the 6 hidden functional files plus the project's five affected test
  files), all pass on the vulnerable tree and with the oracle. The whole-project analysis smoke test
  is not part of the verifier group: it reflects over every generated class and exhausted the
  container PHP memory limit; the affected-area project files cover the same contract.
- Generator path: the project's writer regenerates BaseType/Graph/MultiTypedEntity/ReferencedType into
  a temp root offline (Twig, Flysystem and Illuminate are dev dependencies, installed in the image).
- checks/: miss-tag-option (5 security fail, functional pass), miss-generated-renderers (4 security
  fail, functional pass), miss-referenced-type (3 security fail, functional pass), overescape-values
  (functional fail), hardening and alternative (reward 1.0) — measured both with the local runner and
  by the gate's patches stage in the built images.
- Read-only look at current upstream (master cad2679): the tag option is now escaped with
  htmlspecialchars() in src/Concerns/RendersScript.php, and the body uses JSON_HEX_TAG. So the T1
  route is closed in the latest code; the register row records that.

## Gate results (all stages, built images)

- static: PASSED (2026-10-28T03:56Z, re-run 04:05Z with --report gate_static.json).
- nop: PASSED (2026-10-28T04:01Z): 21/21 security tests fail on the pinned+injected tree, 79/79
  functional tests pass, reward 0.0.
- oracle: PASSED (2026-10-28T04:02Z): 3/3 runs reward 1.0, identical security (21/21) and functional
  (79/79).
- patches: PASSED (2026-10-28T04:05Z): 6/6 checks behaved as declared — the three security_fail
  patches fail exactly their lever's tests with functional all passing, overescape-values fails two
  functional tests, hardening and alternative score 1.0.
- Stage records: build/schema-org-s2/gate_static.json, gate_stage_nop.json, gate_stage_oracle.json,
  gate_patches.json (the last is the gate's own partial report).
- One superseded failure is kept for the record: evidence/20261028T035857Z-gate-nop.txt is a first nop
  run that failed because the verifier's functional group ran the whole-project analysis smoke test
  (one data row per generated class) and hit PHP's 128 MB default. The group now runs the five
  affected project test files and the runner raises the limit; the re-run passed (04:01Z).

## What could not be verified

- No target-model trial was run (forbidden for the builder).
- The advisory text itself was not fetched; the screener record was used as the lead and every claim
  relied on was re-checked against the pinned source.
- Whether the hidden suite can run if an agent deletes vendor/: the artifact restores it; not tested.
- The gate's blind patch and FAIRNESS.md are written later by the pipeline, not by the builder.

## Notes / deviations

- The build prompt names /app as the project directory; the repository's task template, the gate's
  conformance check and every existing task use /workspace. This task follows /workspace so that the
  Harbor artifact, the uid-1000 verifier and conformance_check all agree.
- Injected code is limited to ReferencedType::toScript() in src/ and its static generator template.
  Nothing else in the checkout was changed.
- The generator static ReferencedType template is stale relative to src/ at the pinned commit (it still
  cascades toArray()); this is upstream state, not part of the injection.
