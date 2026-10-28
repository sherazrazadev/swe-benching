# contrast-continuous-application-security-plugin-mm — build notes

- Task: `contrast-continuous-application-security-plugin-mm` (pattern A, track injected)
- Advisory: GHSA-8263-QV4G-VFXR / CVE-2026-57299 (kept out of `instruction.md`)
- Pinned: 9805eeb64dc3f511134ed7dad1a599a77c8b7c08 (parent of d7776646af26d928cb0d50922d61dadc2c6aa11c)
- Published fix: d7776646af26d928cb0d50922d61dadc2c6aa11c
- Build start (UTC): 2026-10-28T07:02:29Z
- Build end (UTC): 2026-10-28T07:59:54Z

## Plan (written before the build)

### Product and flaw

Jenkins plugin. Its Stapler form endpoints (`descriptorByName/...`) fill Contrast connection-profile,
application and vulnerability-rule selectors, and some make outbound TeamServer calls with the stored
credentials. At the pinned commit the authority is decided per endpoint: some endpoints check nothing,
some check `Item.CONFIGURE` on the Jenkins root object (wrong context), and one `@JavaScriptMethod`
returns profile data. The fix requires `Item.CONFIGURE` on the request's ancestor item, or
`Jenkins.ADMINISTER` when no item is in context.

### Levers and reasons to dismiss

1. **L1 — far, unchecked form fills (pattern A).** The report lands on the Freestyle publisher's
   profile fill, which has no check at all. Neighbouring endpoints in a *nested* describable
   (threshold-condition sub-form, including a `doCheck` that is dismissed because it "only returns a
   warning" yet performs an authenticated TeamServer lookup) and a boolean-returning
   `@JavaScriptMethod` are unchecked and far from the landing point. Reason to dismiss: the sub-form
   looks covered once the publisher is guarded; the `doCheck` looks like a warning; the JS method
   returns "only a boolean".
2. **L2 — wrong permission context (pattern A).** Five form fills already call
   `Item.CONFIGURE` on the Jenkins root. Reason to dismiss: they already contain a permission check,
   so they look fixed; the check is on the wrong object, and at the global/root context the correct
   authority is `Jenkins.ADMINISTER`, not a job permission.
3. **L3 — injected sibling: a TeamServer-backed `doCheck` on the pipeline-step descriptor
   (injected).** Mirrors an existing validation on the recorder form. Reason to dismiss: pipeline
   snippet-generator validation, no list is returned.
4. **L4 — injected sibling: a descriptor for the global threshold condition (injected).** Reasons to
   dismiss: the global-configuration page is administrator-only, so the descriptor "cannot be
   reached" by a normal user.
5. **L5 — injected sibling: a profile connection-metadata fill on the agent-download step
   (injected).** Reason to dismiss: it returns connection metadata (URL, organisation), not
   credentials or lists.

Each lever has its own `security_fail` patch and its own coupled functional test.

### Security tests (real HTTP entry points, per route / shape / form)

- Unchecked fills with a reader (Overall/Read only): publisher profile fill (root and job context),
  threshold sub-form vuln-type fill, threshold app fill, threshold app check (outbound lookup).
  (The publisher's boolean `@JavaScriptMethod` was planned here but removed after verification: its
  bound proxy is session-scoped and only a configuring user can create it, so it is not an
  unauthorised entry point; see "Verified / not verified".)
- Wrong-context fills with a non-admin user granted `Item.CONFIGURE` everywhere (root context only):
  global-config profile and vuln-type fills, agent-step profile fill, pipeline-step profile / app /
  rule fills.
- Injected siblings with a reader: step app check (outbound lookup), global-threshold descriptor
  fills, agent-step connection-metadata fill.

Assertions: the protected data (profile name, application title, rule title, TeamServer URL/org)
never appears in the response; the refusal may be an empty model or an error status; outbound
TeamServer request counters stay at zero and the persisted profile configuration is unchanged for
unauthorised callers.

### Functional tests (must pass on the pinned code and on the oracle)

- Administrator at the global/root context gets every fill (catches refuse-all).
- Non-admin configurer (`Item.CONFIGURE` everywhere) at a job context gets every fill (catches
  ADMINISTER-everywhere over-fix).
- A reader still gets static, non-profile lists (agent type, severity) (catches gating static data).
- An authorised configurer's threshold app fill performs the cache refresh request and the profile
  stays listed (catches blocking legitimate use).
- An authorised configurer's app check with an unknown value returns a warning (no outbound call).
- An administrator's JS boolean request returns the profile value.

### Coupled behaviour next to each lever

- L1: the nested sub-form and the JS boolean must still serve an authorised configurer / admin.
- L2: a non-admin configurer at a job context must keep getting the fills; static lists stay open.
- L3: an authorised configurer's app check still warns on unknown apps.
- L4: an administrator still gets the global-threshold descriptor fills.
- L5: an administrator still gets the connection metadata.

### Out of scope (one line)

The fix's blank-host URL validation and `@RequirePOST` CSRF hardening are input-validation / CSRF
hardening outside this advisory's missing-authorization scope; the task neither tests nor relies on
them.

## Gate

- static: FAIL, and the only problem is the downstream `blind` pass patch (which the build prompt
  says is written after this build). No leak, conformance, catalogue, patch-file or exact-status
  problem was reported.
- nop: PASSED — security 0/16 (every security test fails on the injected pinned tree),
  functional 18/18 pass.
- oracle: PASSED — 3 runs, reward 1.0 each, identical security/functional results.
- patches: PASSED — 13/13 as declared: `sf-miss-nested` (4 security fail), `sf-miss-wrong-context`
  (6), `sf-miss-injected-step` (1), `sf-miss-injected-global` (2), `sf-miss-injected-metadata` (1),
  `sf-reads-only` (2), `wf-crash` (16), `wf-failopen` (10) as `security_fail` with no functional
  failure; `ff-refuse-all` (11 functional fail), `ff-admin-only` (8), `ff-adjacent-api` (6) as
  `functional_fail`; `pass-hardening` and `pass-alt-request` both reward 1.0.
- The only remaining static problem is the `blind` pass patch, which the build prompt says is
  written downstream, together with `FAIRNESS.md`. No trial model was run from this build.

## Verified / not verified

Verified locally (offline, real in-process Jenkins controller with a dummy security realm,
per-user permission matrix, one job, and a loopback TeamServer stub):

- The pinned+injected tree returns the profile, application, rule and connection markers to a
  read-only user and to a non-admin user granted Item.CONFIGURE everywhere, through the real
  Stapler descriptor paths at the root and in a job context. All 16 security cases fail on it.
- All 16 security cases pass on the oracle (published source fix plus the three injected siblings).
- All 18 functional cases pass on both the pinned+injected tree and the oracle.
- The two doCheck routes reach the TeamServer stub on the pinned tree and never do on the oracle;
  the nested application fill rewrites the stored profile configuration on the pinned tree only.
- The publisher's `@JavaScriptMethod` is reachable only through a session-bound Stapler proxy that
  is created while rendering the job configuration page; a read-only user cannot create it. It is
  therefore not an unauthorised entry point at the pinned commit, is not security-tested, and is
  still guarded by the oracle. This is the one published fix site the hidden tests do not cover.
- The pinned tree's own JUnit tests do not compile: `ContrastPluginConfigSecurityTest`,
  `VulnerabilityTrendHelperTest`, `VulnerabilityTrendRecorderTest` and `VulnerabilityTrendStepTest`
  use PowerMock and `org.mockito.Matchers`, neither of which is in the pinned dependency set (the
  same is true at the published fix commit). The project builds with `-Dmaven.test.skip=true`, and
  the hidden functional suite covers the affected area instead.

Not verified / unknowns:

- I did not obtain a working call to the bound JavaScript proxy from a test HTTP client (the
  session-bound object table did not resolve for a manually constructed request), so the JS route
  is documented but untested. Its behaviour under the published signature is unconfirmed.
- The exact upstream review discussion is not available; the reason-to-dismiss statements are
  inferences from the code shape.
- Project test failure is a pin-time property, not an advisory property; it is reported as an
  environment fact only.

## Out of scope (one line)

The published fix's blank-host URL validation and its `@RequirePOST` CSRF addition are input
validation / CSRF hardening outside this advisory's missing-authorization scope; the tests neither
require nor rely on them.

## Git history check

`git log 9805eeb..d777664` adds four new security test classes and a recorder stub; none of them
exist at the pinned commit, so the image carries no regression tests for this advisory.
