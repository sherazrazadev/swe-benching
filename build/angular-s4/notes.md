# angular-s4 — build notes

- Start (UTC): 2026-10-30T15:03:17Z
- End (UTC): 2026-10-30T15:52:00Z (all gate stages PASSED)
- Advisory: GHSA-HH8M-FM6V-7CVG / CVE-2026-88057 — XSS / sanitization bypass on directive host
  bindings (CWE-79), angular/angular. Pinned 5ad823139758b4d3a8a021d378b008c3457f8689; published
  fix 6caa298 (direct child of pinned) plus the namespace/i18n revisions 2f96c80 and 6afe6fa on
  release branches.
- Track: injected (Pattern A with two injected host-binding compatibility wrappers).

## Mechanism (one line each)

- Compile time: host-binding security contexts are computed from the declaring directive's
  selector, and `SecurityContext.NONE` is filtered out (ingest.ts, resolve_sanitizers.ts).
- Runtime: the sanitizer receives the TNode tag (the literal `#host` for a dynamic root host),
  so the concrete element and its namespace are never consulted (sanitization.ts, component_ref.ts).
- Static-only attributes (iframe sandbox/allow, SVG `attributeName`/`to`) are validated against
  the same declared tag, so a mismatched host applies them silently.

## Levers

- T1 (how-type, main): selector-vs-concrete-host for HTML sanitization, URL/RESOURCE refusal and
  inherited/host-directive/dynamic-root routes. Compiler must keep the unresolved composite
  context; runtime must resolve the concrete element. Dismissal: "a host binding only runs on
  elements matching the directive selector".
- T2 (how-type, shape): namespaced concrete hosts (MathML `mi` href, SVG animation). Dismissal:
  "the tag name is enough; namespace only matters for element creation".
- T3 (how-type, different protection): static-only attribute refusal must also use the concrete
  host. Dismissal: "the advisory is about sanitization, not about the static-only rule".
- S1 (injected, second implementation): host-binding HTML disposition lives in a dedicated
  wrapper with its own table and no `#host` resolution. Dismissal: it looks like an equivalent
  codegen API.
- S2 (injected, second implementation): static-only refusal lives in a dedicated wrapper with
  its own table and no `#host`/namespace resolution. Dismissal: it looks like the same rule
  already handled elsewhere.
- Coupled over-broad trap: values that are not security-sensitive on the concrete element must
  stay byte-identical (div srcdoc/data/action, SVG rect href, safe URLs/markup); an
  always-sanitize fix fails the functional group (ff-overbroad: functional 10/13).

## Injected siblings — full candidate list and picks

Candidates found (screener O8b plus a search of the pinned tree):

1. A second hand-maintained tag->context table next to `RESOURCE_MAP`, consumed by another
   codegen path (O8b #1). CHOSEN -> S1 (new `host_binding_security.ts`, emitted for Host jobs).
2. A parallel registration in the core copy of the security schema that the compiler copy lacks
   (O8b #2). REJECTED: removing an entry breaks the project's own schema-consistency and
   `SECURITY_SENSITIVE_ATTRS` tests; adding one changes the security policy rather than injecting
   a plausible maintainer slip.
3. The separate i18n attribute sanitizer resolver (O8b #3). REJECTED: i18n attribute bindings
   are not host bindings; using them would fall outside this advisory's protection.
4. A second iframe-sensitive attribute list / neutraliser in `iframe_attrs_validation.ts`
   (O8b #4). CHOSEN in spirit -> S2 (dedicated static-only wrapper with a duplicated list); the
   neutraliser file itself stays untouched so the wrapper is the sibling.
5. JIT environment dispatch map (`render3/jit/environment.ts`). REJECTED as a lever: a wrong
   entry is a where-type typo caught by any test that reaches the API, and it would make JIT and
   AOT diverge in a way the report cannot cover.
6. `url_sanitizer.ts` protocol allow/deny list. REJECTED: it is shared by template bindings, so
   weakening it changes out-of-scope behaviour and the project's own tests.
7. `platform-browser` `DomSanitizationService`. REJECTED: it implements the policy for a context
   already chosen in core; it is not a second classifier of the element/attribute pair.
8. A legacy template-definition compiler path. REJECTED: no such path exists at the pinned commit
   (`calcPossibleSecurityContexts` is called only from `binding_parser.ts` and `ingest.ts`).
9. Host-directive runtime merging (`features/host_directives_feature.ts`). REJECTED: it merges
   into the same compiled hostBindings function; no separate decision to duplicate.
10. i18n compile phase `resolve_i18n_attr_sanitizers.ts`. REJECTED: compile-time i18n attributes
    on known elements, not host bindings.
11. The private-export barrel `core_render3_private_export.ts`. REJECTED: re-export only.

Why the picks beat the others: S1 and S2 are how-type (fixing the published `ɵɵsanitizeHtml` /
`ɵɵvalidateAttribute` entry points changes nothing in them), reachable through the real
host-binding entry point (the compiler routes Host HTML and Host static-only ops to them), placed
in a file the published fix never touches, behaviour-preserving on the pinned tree, and each is
covered by the single general property without a sentence of its own. They were injected as an
earlier, partial "host bindings have their own sanitizer" compatibility layer; the wrappers carry
no deceptive names or comments.

## Verification performed

- Local harness (tsc 6.0.3 with `emitDecoratorMetadata`, esbuild bundle, Node 22 + jsdom 26,
  real Angular JIT/TestBed):
  - pinned+injected: security 0/15, functional 13/13 (every hidden security test fails on the
    vulnerable code, every functional test passes).
  - reference fix (solution/fix.patch): security 15/15, functional 13/13, deterministic.
  - check matrix (each patch applied to the injected tree):
    - sf-miss-t1 3/15 sec, 13/13 fun; sf-miss-t2 12/15, 13/13; sf-miss-t3 12/15, 13/13;
      sf-miss-s1 11/15, 13/13; sf-miss-s2 12/15, 13/13; sf-wrong-resource 12/15, 13/13;
    - ff-overbroad 7/15, functional 10/13; ff-refuse-all 2/15, 12/13; ff-crash 2/15, 12/13;
    - pass-hardening 15/15, 13/13; pass-alt 15/15, 13/13.
- Injection reachability: at pinned+injected the wrappers are emitted for Host HTML and Host
  static-only ops; their own tables do not resolve the dynamic-root marker, which is the gap the
  reference fix closes by delegation.

## Guesses / not verified

- The exact native Bazel/Karma targets for the affected project suites were not run (offline
  image, no Bazel/Chrome). The packages are type-checked on every verifier build and the
  preserved behaviours are covered by the functional group.
- Whether every upstream branch carries the same final revision: the pinned tree takes the direct
  child fix (6caa298); the namespace handling required by T2 comes from the two later published
  revisions, adapted to the pinned schema.
- Build/storage timings are estimates (node:22 + pnpm install + jsdom/esbuild in both images).

## Out of scope (not built on)

- The i18n runtime sanitizer resolver was reviewed while looking for sibling sites and is not
  part of this task's tested surface.
