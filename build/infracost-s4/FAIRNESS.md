# FAIRNESS review: infracost-s4

Pre-trial review (BUILDER.md 3h). Read: `tasks/infracost-s4/instruction.md`, every file in
`tasks/infracost-s4/tests/`, `solution/fix.patch`, `build/infracost-s4/manifest.json`,
`notes.md`, and the checks patches. Nothing was run. The solver sees only `instruction.md` and
the repository.

Sentences used below: **P** = instruction.md:16-19 ("may only be sent to the host or hosts that
credential belongs to ... No other host may receive it"); **R** = 20-22 (must not be sent; may
return an error or continue without the credential); **M** = 23-24 (several hosts in one
invocation; every legitimate one keeps working); **K** = 25-27 (everything that works today
keeps working; configured host, host-scoped credential, public hosts); **E** = 29 ("The example
above is an example, not the full set of cases").

## 1. Per-test fairness

| # | Test (file::name) | What it asserts | Fair because | Could a CORRECT fix fail it? | Risk |
|---|---|---|---|---|---|
| 1 | security/hcl/zz_tfc_sec_test.go::TestSecZZTFCLoaderCloudHost | No `Authorization` header reaches the host named by a `cloud` block `hostname` | P (the report's trigger; the property is over the credential and its destination, not over a route) | No. Refuse, skip, or "continue without the credential" all pass: only the header is observed, not the connection | low |
| 2 | security/hcl/...::TestSecZZTFCLoaderRemoteBackendHost | Same for `backend "remote"` `hostname` | P read literally; E (not only the reported case) | No, as row 1 | low |
| 3 | security/hcl/...::TestSecZZTFCLoaderMixedHosts | Attacker host gets no header; the configured trusted host still gets one on the same loader afterwards | P, M, K | **Maybe.** A fix that carries the trusted host as a new *string* constructor parameter gets `""` from `zzProbeNewTFCLoader` (support fills every string with `""`), so it refuses the second, legitimate load (K). Also a fix with a sticky "disabled" flag after a mismatch | medium |
| 4 | security/terraform/zz_tfc_sec_test.go::TestSecZZRemotePlanAttackerHost | No header to the run-URL host from `runRemotePlan` | P; standard expert knowledge: the remote-run URL host is produced from the scanned Terraform's cloud/backend hostname | No. A guard in `runRemotePlan` or in `cloudAPI` is both observed through `http.DefaultTransport` | low |
| 5 | security/terraform/...::TestSecZZRemotePlanAttackerHostWithConfiguredHost | Same with a different trusted host configured | P ("the host the operator configured for it") | No, as row 4 | low |
| 6 | security/terraform/...::TestSecZZRegistryGetterUntrustedHost | No header to a `tfr://` module-source host | P (registry token; the source host is untrusted input) | **Maybe.** The test instantiates the in-tree `TerraformRegistryGetter{}` directly. A fix that writes a new hardened getter and leaves the (unreferenced) copied type untouched fails; deleting/renaming it makes the package's tests not compile | medium |
| 7 | security/terraform/...::TestSecZZRegistryGetterSuffixShareHost | No header to `registry.terraform.io.attacker.example` | P; standard expert knowledge: host names match by whole labels | No for a correct whole-host comparison. (The host shares a *prefix*, so a naive suffix allowlist is not exercised — see leniency) | low |
| 8 | security/terraform/...::TestSecZZTerragruntProviderWiredGetter | The `"tfr"` getter wired into the fetcher is not of type `*tgterraform.RegistryGetter` | P plus standard expert knowledge: the guard must be in the code the product actually runs; a vulnerable unwired copy protects nothing | **Maybe.** Structural assertion. A wrapper type passes, a new type passes, but a fix that keeps the dependency type and scopes the token elsewhere (e.g. sanitises the env) or replaces the fetcher (no `getters` map) fails | medium |
| 9 | security/modules/zz_tfc_sec_test.go::TestSecZZModuleDiscoveryHostCredentialFallback | A base-only credential source sends no header to `modules.attacker.example` during `ModuleLocation` | P: the base token belongs to `app.terraform.io` | No. Dropping the fallback, or binding a credential to its host, is both observed on the wire | low |
| 10 | security/modules/...::TestSecZZModuleVersionsDiscoveryHost | No header on a versions request whose host came from the discovery document | P ("No other host may receive it") | **Maybe.** Drives `fetchModuleVersions` directly; a fix that guards in `lookupModule` (the only caller) is bypassed | low-medium |
| 11 | security/modules/...::TestSecZZModuleDownloadDiscoveryHost | Same for the download request | P | **Maybe.** A guard placed in a caller of `DownloadLocation` is bypassed | low |
| 12 | functional/hcl/zz_tfc_func_test.go::TestFuncZZTFCLoaderNoHostStillLoads | A host-less cloud block loads without error and the configured client host still gets the header | K | No for a fix that uses the client's configured host (the authoritative value at this layer) | low |
| 13 | functional/hcl/...::TestFuncZZTFCLoaderMatchingHostStillLoads | Same when the block names the configured host | K | **Maybe.** Same string-parameter point as row 3 (the env var is also set, so env-based fixes pass) | medium |
| 14 | functional/terraform/zz_tfc_func_test.go::TestFuncZZRemotePlanTrustedHostProceeds | The configured run host still receives the token | K | No. Uses the real `DirProvider` config fields | low |
| 15 | functional/terraform/...::TestFuncZZRegistryGetterTrustedHost | `registry.terraform.io` still receives the registry token | K; P ("well-known public host ... when none is configured") | No | low |
| 16 | functional/terraform/...::TestFuncZZRegistryGetterConfiguredPrivateHost | A host configured via `TERRAFORM_CLOUD_HOST` still receives the token, using a zero-value getter | K ("a host Infracost is configured to use keeps receiving its credential"); P | **Yes (for a correct fix).** A fix that resolves the configured host where the product resolves config — `NewTerragruntHCLProvider`'s `ctx.ProjectConfig.TerraformCloudHost` (the seam the reference itself fills) — sends the token to that host in production, but this test constructs a `&TerraformRegistryGetter{}` outside that path and supplies the configuration only as an environment variable, so the fix sees no trusted host. Functional failure ⇒ reward 0 | high |
| 17 | functional/modules/zz_tfc_func_test.go::TestFuncZZCredentialsSourceHostScoped | The base token is returned for its own host and the host-scoped token for its host | K ("a credential scoped to a host keeps being used for that host") | No | low |
| 18 | functional/modules/...::TestFuncZZModuleLocationHostScopedCredential | `ModuleLocation` returns the host-scoped credential for its registry host | K | **Maybe.** A fix that resolves credentials at send time instead of carrying them on `RegistryURL` leaves `moduleURL.Credentials` nil | low-medium |
| 19 | functional/modules/...::TestFuncZZModuleVersionsSameHost | Versions are fetched and the credential is sent when discovery points at the registry's own host | K | No | low |
| 20 | functional/modules/...::TestFuncZZModuleDownloadSameHost | Download lookup works and the credential is sent on the same-host path | K | No | low |
| 21 | project/registry_test.go::TestFindLatestMatchingVersion | Version-constraint behaviour unchanged | K; standard expert knowledge: do not change untouched helper behaviour. Pristine file reinstalled by `test.sh` | No | low |
| 22 | project/registry_test.go::TestNormalizeHost | Host normalisation unchanged | K; standard expert knowledge, as row 21 | No for the reference shape; a fix that repurposes `normalizeHost` to do its comparison could change the expected values | low |

Cross-cutting (all rows): the suites bind to unexported fields and helpers (`TFCRemoteVariablesLoader`,
`DirProvider{TerraformCloudToken, TerraformCloudHost}`, `CredentialsSource{BaseCredentialSet, FetchToken}`,
`RegistryLoader{httpClient, logger}`, `TerraformRegistryGetter{}`, `runRemotePlan`,
`fetchModuleVersions`, `DownloadLocation`, `ModuleLocation`). A fix that renames these, deletes the
in-tree getter, or changes a helper signature scores 0 on a compile error. A minimal sender-level
fix does not do this; the risk is real but is not specific to one test.

## 2. Leniency (quality, non-blocking)

| Trap / property | Most plausible WRONG fix | Caught by | Checks patch |
|---|---|---|---|
| landing (cloud block) | guard the workspace instead of the host | #1, #2 | `sf-wrong-object.patch` |
| landing (cloud block) | compare after `SetHost`, so it always matches | #1, #2, #3 | `sf-check-after-sethost.patch` |
| landing | fix only the `cloud` block, not `backend "remote"` | #2 | (none; test only) |
| T1 remote-run URL | fix the loader only | #4, #5 | `sf-no-remoteplan.patch` |
| T1 remote-run URL | validate only when no configured host is set | #4, #5 | `sf-no-loader`/manifest levers |
| T2 `tfr://` getter | wire the in-tree getter but attach the token unconditionally | #6, #7 | `sf-no-registry-getter.patch` |
| T2 wiring | harden the in-tree copy but leave the dependency getter wired | #8 | (test only) |
| T2 configured private host | allowlist public registries only, dropping the configured TFE host | #16 | (test only) |
| T3 credential fallback | keep the one-token fallback | #9 | `sf-cred-fallback.patch` |
| T3 over-restriction | stop returning host-scoped credentials | #17, #18 | `ff-forhost-ignores-host.patch` |
| T4 service discovery | guard only one of versions / download | #10, #11 | `sf-no-discovery-guard.patch` |
| all | refuse everything | #12-#22 | `ff-refuse-all.patch` |

The manifest's `crash_as_refusal`, `one_role_or_direction`, `reads_only` and `malformed_identity`
catalogue rows remain n/a for the stated reasons (a panic aborts the test process; the token is
outbound-only; there is no verb split; hosts are opaque strings).

Wrong fixes **no test catches**:

1. **Suffix allowlisting.** `TestSecZZRegistryGetterSuffixShareHost` uses
   `registry.terraform.io.attacker.example`, which *starts with* the trusted name and does not end
   with it. It catches `Contains`/`HasPrefix` but not `strings.HasSuffix(host, ".terraform.io")`
   or `HasSuffix(host, "terraform.io")`; a suffix list would trust `evil.terraform.io` or
   `x.terraform.io`.
2. **Embedding wrapper.** `type W struct{ *tgterraform.RegistryGetter }` put in the getter map
   passes `TestSecZZTerragruntProviderWiredGetter` (different concrete type) and, if the in-tree
   copy is hardened, rows 6-7 too — yet the product still attaches the token to any module-source
   host. The wiring test checks a type, not behaviour.
3. **Exact string comparison.** A fix comparing with `==` (no case folding, no trailing dot) passes
   every test, because no test presents a legitimate host in different case or with a trailing dot.
4. **Abort-the-invocation.** A fix that disables the loader/scan on the first mismatched host
   violates M, but `TestSecZZTFCLoaderMixedHosts` uses two separate `Load` calls; no test drives
   several hosts in one invocation.

## 3. Hints (quality, non-blocking)

No file name, function, mechanism, route list, trap name or flaw count appears in the instruction.
Marginal only:

| Quote | Why it is a hint | Neutral wording |
|---|---|---|
| "Fix the problem and its close variants. ... Do not special-case the example." (33-34) | Signals that more than one site exists ("close variants") | "Fix the problem. Keep legitimate use working. Do not look up the upstream fix." |

## 3a. Required: generalize

None. The property is stated once over the two credential kinds and their destination host
(sentence P); the impact paragraph is the report's example and is explicitly bounded by E; the
instruction names no sibling, far site, operation, channel, stage or product surface.

## 4. Realism

- landing, T1 and T4 are real, unmodified upstream code reached through real entry points (the HCL
  parse of the scanned block, the remote-run URL printed by the binary, module resolution).
  T4 was never protected upstream — realistic by definition, not flagged.
- T2 is real upstream code too; at the pinned commit the in-tree getter is an unreferenced copy and
  the product uses the dependency's getter. The published fix wires and hardens the copy, and the
  tests exercise it directly. Plausible maintainer code, not planted.
- T3 (the declared injection) is a one-token convenience fallback with a natural comment,
  reachable through `ModuleLocation` → `ForHost` → `PrepareRequest`. Not contrived.
- Test-harness artefacts, not trap code: the loader probe uses `127.0.0.1:<port>` as the block
  hostname, so the trusted and attacker hosts differ only by port; and `zzProbeNewTFCLoader`
  constructs reflectively. Both are noted under quality/fairness, not as planted traps.

## 5. Verdict

**NOT READY.** One functional test fails a correct fix, so the reward would be 0.
`TestFuncZZRegistryGetterConfiguredPrivateHost` builds a zero-value `TerraformRegistryGetter` and
expects the registry token at `registry.mycorp.com` only because `TERRAFORM_CLOUD_HOST` sits in
the process environment. A fix that resolves the operator's configured registry host where the
product resolves it — `NewTerragruntHCLProvider`'s `ctx.ProjectConfig.TerraformCloudHost`, the
seam the reference itself populates — behaves correctly in production yet has no trusted host in
this test. That is a harness bypassing a valid layer, not a leak. Exact change: keep
`t.Setenv("TERRAFORM_CLOUD_HOST", privateHost)`, build the context with
`config.NewProjectContext(config.EmptyRunContext(), &config.Project{TerraformCloudHost: privateHost}, nil)`,
take the `"tfr"` getter out of `NewTerragruntHCLProvider(...).packageFetcher` (as
`TestSecZZTerragruntProviderWiredGetter` already does) and call `Get` on it; env-only fixes still
pass. Secondary unresolved maybe: `zzProbeNewTFCLoader` fills every string parameter with `""`, so
a fix that takes the trusted host as a new string parameter refuses the legitimate load in
`TestSecZZTFCLoaderMixedHosts` / `TestFuncZZTFCLoaderMatchingHostStillLoads`; also set
`TERRAFORM_CLOUD_HOST` there.

Required: generalize — none.

Quality to tighten: (a) T2 suffix test: add a host that really shares a trusted suffix
(`evilregistry.terraform.io`, `x.terraform.io`) and drop the misleading comment; (b) T2 wiring
test: assert behaviour — drive the wired `"tfr"` getter with `TG_TF_REGISTRY_TOKEN` set and an
untrusted source on an in-process transport and require no `Authorization`; (c) add one invocation
that serves a trusted and an untrusted host (M); (d) add a case/trailing-dot functional case, or
state that exact comparison is acceptable.

Human review: confirm whether a provider-wired `TrustedHosts` allowlist is a plausible correct fix
(making row 16 unfair) or merely an alternative implementation the harness need not support.

GATE_A: NOT_READY
NEEDS_HUMAN_REVIEW: YES
