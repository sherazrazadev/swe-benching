# infracost-s4 — build notes

- Started (UTC): 2026-10-29T12:54:58Z (pipeline start). Design fixed and recorded before any
  task file was written; the tree was cloned and read first.
- Finished (UTC): 2026-10-29T14:05:41Z.

## Advisory and pinned tree

- GHSA-6X6C-W9W9-HV4H / CVE-2026-71494 / GO-2026-6437, infracost/infracost, CWE-522:
  a configured Terraform Cloud/registry token is sent to a host named by the scanned Terraform or
  module source.
- Pinned `565bcce88b2e61f48115bd48722b6606ac08abd6` is the direct parent of the published fix
  `3d24c757f5e4e60c7259f1b89ad7ceaabcfca86f` (`git log 565bcce8..3d24c757` lists only the fix).
  The fix adds `internal/hcl/remote_variables_loader_tfc_test.go` and
  `internal/providers/terraform/cloud_security_test.go`; neither is present at the pinned commit,
  so the image contains no regression test from the fix.
- Track: injected. `environment/inject.patch` adds the T3 fallback; the oracle removes it.

## General security property (written once, before choosing routes)

A credential Infracost is configured with — a Terraform Cloud/Enterprise API token or a Terraform
registry token — may only be sent to the host or hosts that credential belongs to: the host the
operator configured for it, or the well-known public host(s) of that service when none is
configured. No other host may receive it; an operation that would send it elsewhere must not, and
may return an error or continue without the credential. One invocation must keep serving every
legitimate host while refusing the illegitimate one, and everything that works today keeps
working exactly as today.

Every route and sibling below falls under that sentence as written. The report names only the
trigger (a host named inside a scanned project) and states the property over the credential and
its destination host, so it covers the far sites and the injected sibling without pointing at
any of them.

## Levers (each with a different reason a solver skips it)

- **landing — A, published landing point.** Host named by the scanned Terraform (`cloud` block
  `hostname` and `backend "remote"` `hostname`) is written onto the token-bearing client.
  Site: `internal/hcl/remote_variables_loader.go:167-181`. Reason to dismiss: none; it is the
  reported trigger and the positive control. Coupled: a cloud block with no host, and one that
  names the configured host, must still load.
- **T1 — A, published far site (how-type adjacent).** The remote-run URL printed by the terraform
  binary supplies the host to `cloudAPI`, in a different package and through a different sender.
  Site: `dir_provider.go:462-497`, `cloud.go:17`. Reason to dismiss: the report is about the
  scanned Terraform, not the binary's stdout. Coupled: a run URL on the configured host must
  still be contacted.
- **T2 — A, second implementation (where-type extra).** The in-tree `TerraformRegistryGetter`
  attaches `TG_TF_REGISTRY_TOKEN` to whatever registry domain the `tfr://` module source names.
  At the pinned commit the file says it was copied from terragrunt and the type is not
  referenced (the product uses the dependency's getter); the published fix wires and hardens it.
  Site: `terragrunt_registry_service.go:287,342-371`, `terragrunt_hcl_provider.go:136-150`.
  Reason to dismiss: dead-looking vendored code and a different secret. Coupled: the public
  registry keeps receiving the token.
- **T3 — B, how-type: a producer the check never calls (injected).**
  `CredentialsSource.ForHost` falls back to the configured Terraform Cloud token when the
  module-source host has no credential of its own. The token-sending guards never call `ForHost`;
  the credential reaches the discovery request directly. Site:
  `internal/hcl/modules/credentials_source.go:80-88` (injected).
  Reason to dismiss: the provider looks host-scoped, it is in the module-loading subsystem far
  from every sender the report suggests, and a one-token fallback looks like a convenience.
  Coupled: base-host and host-scoped credentials keep working.
- **T4 — B, how-type: a route where the protection never existed (real upstream).**
  `ModuleLocation` builds the versions URL from the registry's service discovery document, and
  `DownloadLocation` resolves the download URL the same way; both attach the credential looked
  up for the registry host to whatever host the document names. The published fix never touches
  this file. Site: `internal/hcl/modules/registry.go:167-174,289-297`.
  Reason to dismiss: the module source host is user-chosen and its discovery document is part of
  the protocol Terraform itself follows, so the redirect target looks like the trusted registry's
  own decision. Coupled: a registry that serves versions/download from its own host keeps
  receiving its credential.
- **Coupled must-keep-working** (functional tests): configured Terraform Enterprise/private host
  still receives its token; host-scoped credentials from the operator's Terraform configuration
  files still apply to their hosts; the public registry hosts still receive the registry token;
  a matched host and a host-less cloud block still load. The `ff-refuse-all` patch proves an
  over-broad fix fails.

## Candidate sibling sites and routes (full list) and why the picks won

1. `cloud.go` low-level "send bearer token" sibling helper (O8b-1) — rejected: the published fix
   edits `cloud.go` itself; any sibling sits within ~20 lines of the fix hunk (low distance).
2. `credentials_source.go` `ForHost` fallback (O8b-2) — **picked T3**: far package, never touched
   by the fix, producer off the token-sender path, one-token fallback is plausible.
3. `terragrunt_hcl_provider.go` second getter registration (O8b-3) — rejected: the fix rewrites
   the getter map in that exact file.
4. `registry.go` service-discovery download URL (O8) — **picked T4**: real unmodified upstream,
   never touched by the fix, different package, plausible "trusted registry protocol" dismissal.
5. `internal/credentials/terraform.go` fallback to a default-host credential — rejected: same
   concept as T3 (a credential issued for another host), and the published fix's token selection
   calls this function directly, so the producer would be on the check's path.
6. `plan_cache.go` stored `TerraformCloudToken`/`TerraformCloudHost` — rejected: the cache stores
   plan bytes and its state is part of the cache key; nothing in it is sent, so there is no sink.
7. `dir_provider.go` `CreateConfigFile` writes the token into a temporary `.terraformrc` for the
   configured host — rejected: the host and token are operator-configured, not attacker-named.
8. `apiclient/client.go:131` Bearer token — out of scope: the Infracost API key, not a Terraform
   Cloud/registry credential.
9. `vcs/metadata.go` GitLab/Azure tokens — out of scope: VCS credentials.
10. `registry.go` `ModuleLocation`'s `Location` — same route family as T4; its versions request is
    covered by the T4 guard.
11. `public_checker.go` HEAD to the module source — rejected: attaching a credential to a public
    availability check is not plausible maintainer code, and the checker only runs with a remote
    cache configured.
12. `extclient` proxy selection — rejected: the proxy is operator-configured, not attacker-named.
13. `terragrunt_registry_service.go` `GetFile`/other methods — file touched by the fix; no send.
14. The loader's `RemoteVariablesLoaderWithRemoteConfig` override — the host comes from the
    resolved trusted config, not the scanned input.
15. `parser.go` / `hcl_provider.go` / `authed_client.go` wiring — all touched by the published fix.

Only one injected gap is shipped (T3) because the remaining plausible injection sites are either
in files the published fix edits (O8b-1, O8b-3) or repeat T3's concept (candidate 5); the task's
other B lever (T4) is real upstream code, which the design prefers over a planted copy.

## What was verified (locally, same files and commands test.sh uses)

- Hidden tests staged into the three packages, run as the verifier does:
  - injected (pinned + injection): security 0/9 pass (all nine fail), functional 9/9 pass (7 hidden + 2 project).
  - oracle: security 9/9, functional 9/9.
  - `sf-no-loader`, `sf-no-remoteplan`, `sf-no-registry-getter`, `sf-cred-fallback`,
    `sf-no-discovery-guard`, `sf-wrong-object`, `sf-check-after-sethost`: each leaves at least
    one security test failing with the whole functional group green.
  - `ff-refuse-all`, `ff-forhost-ignores-host`: security green, functional fails.
  - `pass-hardening`, `pass-alternative`: everything green.
- Project test: pristine `internal/hcl/modules/registry_test.go`
  (`TestFindLatestMatchingVersion`, `TestNormalizeHost`) passes on the injected tree and under
  every pass patch.
- No run needs the network: the only I/O is a loopback listener with a self-signed certificate
  (connection counting; the client rejects the certificate and does not retry) and in-process
  `http.RoundTripper`s that record `Authorization` headers. The test suite never resolves a name
  or dials a remote host.

## What could not be verified / guesses

- The `pass-hardening` / `pass-alternative` patches are author-written correct fixes, not blind
  fixes; the blind patch is produced later by the pipeline and was not available here.
- The T2 security tests call the in-tree getter directly. A solver who hardens a different layer
  (for example wraps the dependency's getter) and leaves the in-tree getter vulnerable would
  pass security but leave the in-tree code vulnerable. The reference fix both hardens and wires
  the in-tree getter; the tests do not assert the wiring (that would forbid a valid fetcher-level
  design).
- The loader's "matching configured host still loads" functional test constructs the loader with
  the trusted host on the client (the only stable input at that layer). A fix that introduces a
  separate trusted-host field and ignores `client.Host()` would fail that test; the reference fix
  and the alternative both use the client's host.
- Docker image build, Harbor runs and the gate stages: the environment and verifier images were built and an offline verifier simulation gave reward 0.0 on the nop workspace and 1.0 on the fixed workspace; the gate stages then passed: static, nop (9 security failing / 9 functional passing), oracle (3/3 runs, reward 1.0, identical), patches (all 11 declared checks matched their expectation).

## Pattern B register rows

- `infracost-s4`, infracost/infracost, GHSA-6X6C-W9W9-HV4H / CVE-2026-71494 / GO-2026-6437,
  trap T4, real_upstream yes, present_in_latest unknown (not checked), public_upstream_report
  unknown, in_current_scope yes (B), built yes, note "registry service discovery names the
  versions/download host; the credential is attached there", disclosure pending client decision.
- `infracost-s4`, same advisory, trap T3 (injected), real_upstream no (injected sibling),
  present_in_latest n/a, public_upstream_report unknown, in_current_scope yes (B), built yes,
  note "injected one-token fallback in the module credential provider", disclosure pending
  client decision.

## Fairness revision (2026-10-30)

Addressed the pre-trial FAIRNESS review and the three trial-audit findings.

- instruction.md generalised as required (no CLI command, no product-surface list, no
  private-TFE example); the property is stated once over the credential and its destination
  host. No leak term appears in it.
- Landing and T1 security tests now observe the Authorization header on a trusted loopback TLS
  server instead of counting connections, so a fix that connects but omits the credential
  (explicitly allowed by the instruction) passes. A mixed-host test drives one loader against
  an untrusted then a trusted host.
- Loader tests construct through NewTFCRemoteVariablesLoader (reflectively, so a fix that adds
  a constructor parameter still compiles) rather than a struct literal.
- T4 tests drive Disco.ModuleLocation with ForceHostServices and credentials obtained through
  CredentialsSource.ForHost; no HostCredentials{} literal remains. This makes the tests
  layer-agnostic and follows the real ModuleLocation -> versions/download path.
- T2: added a wiring security test (the fetcher must not still use the dependency registry
  getter) and functional coverage for a configured private registry host.
- T3: added ModuleLocation coverage for a host-scoped credential.
- Local re-verification: nop 0/11 security + 11/11 functional; oracle 11/11 + 11/11; all 12
  declared checks match their expectation. Manifest trap test lists and verified counts updated.

