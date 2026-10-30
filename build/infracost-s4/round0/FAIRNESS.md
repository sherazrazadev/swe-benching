# FAIRNESS review: infracost-s4

Reviewer: pre-trial fairness/leniency gate (BUILDER.md 3h). I did not write the tests and ran nothing (no Docker, trials, gates, upstream lookup). Inputs read: tasks/infracost-s4/instruction.md, every file under tests/ (security, functional, support, project, test.sh, score.py), solution/fix.patch, build/infracost-s4/manifest.json, notes.md, and the checks patches named below (for sf-no-loader, sf-no-registry-getter, sf-no-remoteplan, sf-cred-fallback I relied on the manifest plus the shared hunks visible in the other full-size patches).

General property (P), instruction.md:16-22: a configured Terraform Cloud/Enterprise or registry token "may only be sent to the host or hosts that credential belongs to ... No other host may receive it", and "it must never deliver the credential to the wrong host". Preservation (K): 25-28 plus "The example above is an example, not the full set of cases" (30).

## 1. Per-test fairness

| # | Test (file::name) | Asserts | Fair because | Could a correct fix fail? | Risk |
|---|---|---|---|---|---|
| 1 | security/hcl/zz_tfc_sec_test.go::TestSecZZTFCLoaderCloudHost | 0 connections to the host named in a `cloud` block `hostname` | P (the report's trigger; the property is over the credential and destination host) | No for the primary fix (refuse or skip). Maybe for a fix that drops the credential at the client layer but still requests the host ("continue without the credential", 20-22): the test counts connections, not credential delivery. | medium |
| 2 | security/hcl/...::TestSecZZTFCLoaderRemoteBackendHost | 0 connections via `backend "remote"` `hostname` | P read literally; "not the full set of cases" (30); expert knowledge: the remote backend hostname names a TFC/E host | Same as #1 | medium |
| 3 | security/terraform/...::TestSecZZRemotePlanAttackerHost | 0 connections to the host in the remote-run URL | P ("No other host may receive it"); expert knowledge: that URL is produced from the scanned cloud/backend hostname | Maybe: same connection-count / "continue" point as #1. A fix that guards only the loader is the trap, not a correct fix. | medium |
| 4 | security/terraform/...::TestSecZZRemotePlanAttackerHostWithConfiguredHost | 0 connections when `tfe.mycorp.com` is configured | P ("the host the operator configured for it") | Same as #3 | medium |
| 5 | security/terraform/...::TestSecZZRegistryGetterUntrustedHost | no `Authorization` header on any request to `registry.mycorp.com` | P (registry token) | Maybe: the test builds the in-tree `TerraformRegistryGetter` directly. That type is unreferenced at the pinned commit (the product uses `tgterraform.RegistryGetter`), so a correct fix at the getter-map/fetcher layer (wrap or replace the used getter, leave the stale copy) fails. Wiring and hardening this type (the natural fix; the repo ships the copy) passes. | medium |
| 6 | security/terraform/...::TestSecZZRegistryGetterSuffixShareHost | no auth to `registry.terraform.io.attacker.example` | P; expert knowledge: host names match by whole labels, not suffix | No: any exact/label comparison passes; suffix-in-the-wrong-direction is the bug | low |
| 7 | security/modules/...::TestSecZZModuleDiscoveryHostCredentialFallback | no auth to `modules.attacker.example` from a base-token-only source | P: the base token belongs to `app.terraform.io` | No | low |
| 8 | security/modules/...::TestSecZZModuleVersionsDiscoveryHost | no auth when the versions URL host came from service discovery | P | Maybe: the test drives unexported `fetchModuleVersions` with a hand-built `RegistryURL`. A guard in the caller (`lookupModule`) or when binding credentials to the URL is a valid layer and fails; the sender-level guard (natural) passes. | low-medium |
| 9 | security/modules/...::TestSecZZModuleDownloadDiscoveryHost | same for `DownloadLocation` | P | Maybe: same caller-layer point as #8 | low-medium |
| 10 | functional/hcl/...::TestFuncZZTFCLoaderNoHostStillLoads | no error; client host contacted | K ("the public hosts keep working") | No | low |
| 11 | functional/hcl/...::TestFuncZZTFCLoaderMatchingHostStillLoads | no error; host contacted when the block names the configured host | K ("a host the operator configured ... keeps receiving its credential") | Maybe: the loader is a struct literal, bypassing `NewTFCRemoteVariablesLoader`; a fix that keeps the trusted host in a new constructor-set field sees `""` and refuses. Comparing with `client.Host()` (natural) passes. | medium |
| 12 | functional/terraform/...::TestFuncZZRemotePlanTrustedHostProceeds | configured host contacted | K | No | low |
| 13 | functional/terraform/...::TestFuncZZRegistryGetterTrustedHost | an authenticated request to `registry.terraform.io` | K ("the public hosts keep working"); the env token has no configured host, so its default is the well-known public registry (17-19) | No: refusing the public registry contradicts 17-19 | low |
| 14 | functional/modules/...::TestFuncZZCredentialsSourceHostScoped | base token for its host; host-scoped token for `registry.mycorp.com` | K ("credentials configured for individual hosts keep being used for those hosts") | No | low |
| 15 | functional/modules/...::TestFuncZZModuleVersionsSameHost | versions returned; auth sent | K ("Everything that works today keeps working exactly as today") | No | low |
| 16 | functional/modules/...::TestFuncZZModuleDownloadSameHost | auth sent when discovery points at the same host | K | No | low |
| 17 | project/registry_test.go::TestFindLatestMatchingVersion | version-constraint behaviour unchanged | K; pristine restored project test | No | low |
| 18 | project/registry_test.go::TestNormalizeHost | host normalisation unchanged | K; pristine restored project test | No | low |

Cross-cutting (all tests, low-medium): the hidden tests bind to unexported state — `TFCRemoteVariablesLoader{client, logger}`, `DirProvider{TerraformCloudToken, TerraformCloudHost}`, `TerraformRegistryGetter{}`, `CredentialsSource{BaseCredentialSet, FetchToken}`, `HostCredentials{token: ...}`, `RegistryLoader{httpClient, logger}`, and call `runRemotePlan`, `fetchModuleVersions`, `DownloadLocation`, `ModuleLocation`. A fix that renames these, or deletes the stale in-tree getter as dead code, fails to compile and scores 0. A minimal fix does not do this.

PM-rule resolution: the primary-mechanism fix — compare every destination host with the host the credential belongs to at the sender, then refuse or skip — passes all 18. Rows 1-4, 5, 8-9, 11 are failed only by alternative layers or the instruction's own "continue without the credential" allowance; they are gate b, not gate a.

## 2. Leniency

| Property / trap | Most plausible wrong fix | Caught by | Check patch |
|---|---|---|---|
| landing (cloud/backend hostname) | guard the workspace instead of the host; or check after `SetHost` | #1, #2 | sf-wrong-object.patch, sf-check-after-sethost.patch |
| landing | fix the `cloud` block only, not `backend "remote"` | #2 | (none) |
| T1 remote-run URL | fix the loader only | #3, #4 | sf-no-remoteplan.patch |
| T2 tfr getter | wire the in-tree getter but attach the token unconditionally | #5, #6 | sf-no-registry-getter.patch |
| T2 tfr getter | suffix/prefix matching against the trusted list | #6 (prefix/contains); a `HasSuffix(host, "terraform.io")` list would pass #6 | (none) |
| T2 wiring | harden the in-tree getter but leave the dependency getter wired | **no test** (no test asserts the getter map) | (none) |
| T2 configured private registry | allowlist the public registries only, dropping the configured TFE/private registry host | **no test** (#13 uses only `registry.terraform.io`) | (none) |
| T3 fallback | keep the one-token fallback | #7 | sf-cred-fallback.patch |
| T3 over-restriction | return no host-scoped credentials | #14 | ff-forhost-ignores-host.patch |
| T3 layer | make Disco attach credentials only for the base host | **no test** (no host-scoped credential is driven through `ModuleLocation`) | (none) |
| T4 discovery | guard the download only, not the versions request | #8 | sf-no-discovery-guard.patch |
| loader | abort the whole scan on the first mismatched host | **no test**: the multi-host sentence (23-24) is never exercised; every test drives one host | (none) |
| all | refuse everything | #10-#16 | ff-refuse-all.patch |
| all | panic as refusal | the test process aborts; not shippable | n/a |

Wrong fixes no test catches: (a) harden the in-tree getter without wiring it — the product still uses the vulnerable dependency getter; (b) allowlist only the public registries, so a configured private registry loses its token; (c) a Disco-level base-host-only whitelist that drops host-scoped module credentials; (d) abort-the-run on the first mismatch, against 23-24; (e) exact-string host comparison (a trusted host written with another case or a trailing dot stops working).

## 3. Hints (instruction.md)

No file, function or manifest leak_term appears. No flaw count and no route list. Soften:

| Quote | Paraphrases | Neutral wording |
|---|---|---|
| "as a Bearer credential" (10-11) | the wire form of the token | drop: "send the operator's configured Terraform Cloud token, to a host named inside that project" |
| "Running `infracost breakdown --path <directory>`" (9) | the CLI command / stage | "Scanning a Terraform project supplied by someone else" |
| "scans Terraform and Terragrunt projects" (3) | Terragrunt is the tfr:// surface | "scans infrastructure-as-code projects" |
| "To read remote data and modules" (4) | names the remote-variable/plan and module channels | "It uses Terraform Cloud/Enterprise API tokens and Terraform registry tokens" |
| "including a private Terraform Enterprise or private registry host" (26) | a trap surface, T2 | covered by "Everything that works today keeps working exactly as today" |

## 4. Realism

- landing, T1 and T4 are real, unmodified upstream code at the pinned commit and are reached through real entry points (HCL parse of the scanned block; the remote-run URL printed by terraform; module resolution). Never flag T4 as outside the published fix.
- T2 is also real upstream code, but at the pinned commit the getter is an unreferenced copy (the product uses `tgterraform.RegistryGetter`); the getter-map wiring is the real seam. The stale copy is plausible maintainer code, not planted; the direct-call test (row 5) is the only realism concern.
- T3 is the declared injection; a one-token convenience fallback in `ForHost` is exactly what a maintainer writes, and it is reached through `ModuleLocation` → `ForHost` → `PrepareRequest`. Not contrived.

## 5. Verdict

**GATE_A: READY.** The primary correct fix — compare each destination host with the host the credential belongs to, at the sender, and refuse or skip on mismatch — passes all 18 tests; reference, pass-hardening and pass-alternative score 1.0 and the pristine project tests are untouched. No test demands an error class or message. The "maybe" rows are alternative layers or the instruction's own "continue without the credential" allowance; their primary-mechanism counterparts pass, so they are gate b.

Required: generalize (3a):
- "Running `infracost breakdown --path <directory>` on a Terraform project supplied by someone else" → "Scanning a Terraform project supplied by someone else".
- "a CLI that scans Terraform and Terragrunt projects and estimates their cloud cost" → "a CLI that scans infrastructure-as-code projects and estimates their cloud cost".
- "To read remote data and modules it uses ..." → "It uses Terraform Cloud/Enterprise API tokens and Terraform registry tokens ...".
- "a host the operator configured (including a private Terraform Enterprise or private registry host) keeps receiving its credential, credentials configured for individual hosts keep being used for those hosts" → "a host Infracost is configured to use keeps receiving its credential, and a credential scoped to a host keeps being used for that host".

Quality to tighten:
- T2: drive the wired getter (or declare the in-tree type the contract) so a fetcher-level wrapper passes and a harden-without-wiring fix fails.
- Loader: construct through `NewTFCRemoteVariablesLoader`, so a trusted-host-field fix is not failed.
- Landing/T1: observe credential delivery, not any connection; add a single-invocation mixed-host test.
- Add functional coverage for a configured private registry host (T2) and for a host-scoped credential through `ModuleLocation` (T3).
- Soften the hint phrases above.

Human review: confirm the T2 tests may require the unreferenced in-tree `TerraformRegistryGetter` to be hardened (a fix wrapping the used dependency getter would fail), and that the loader tests bypass `NewTFCRemoteVariablesLoader` (a trusted-host field set only there fails the matching-host test).

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
