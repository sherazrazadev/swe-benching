# aws-cli-s2 — build notes

- Start UTC: 2026-10-27T19:11:04Z
- End UTC: 2026-10-27T19:46Z

## Task shape

- Repo `aws/aws-cli` (AWS CLI v1.44.75), pinned `6c0f166e073dbaab812bc8cb26ad085f3e114c16`.
- Published fix commits: `e0799fde` (CodeArtifact), `68811b5a` (virtual MFA), `84f0ec6a`
  (CodeDeploy, release-branch sibling of the same change set).
- Family: insecure file permissions / credential exposure (CWE-732). The CLI writes credential
  material to a file with a plain `open()`, so the file gets the process umask (0644 under the
  default 022) instead of owner-only.
- Pattern A+B, injected track: the published fix's sites (A), two real routes the fix never
  touched (B), and one realistic sibling gap added to our copy (injected).

## The one security property (stated once in instruction.md)

Authentication material the CLI saves to a file — keys, tokens, seeds or similar credentials —
must end up accessible only to its owner, whether the CLI creates the file or replaces/appends
to a file that already exists, and whether the command is a service call or a local helper.
If the permissions cannot be tightened the command must still finish and warn; it must not fail.

Every route below is covered literally by that property; the instruction never names a route.

## Levers (one line each)

- T1 A landing, how-type shape: virtual-MFA bootstrap `--outfile` — `iamvirtmfa.py:74` plain
  `open(outfile,'wb')`; a *pre-existing* 0644 outfile keeps its mode, and the tempting fix
  (`compat_open(..., access_permissions=0o600)` / `os.open(...,0o600)`) only applies the mode on
  creation, so the existing-file shape still leaks. Reason a solver skips it: passing a create
  mode looks like the complete fix.
- T2 A far, where-type: CodeDeploy `register` writes `codedeploy.onpremises.yml` with
  `aws_secret_access_key` — `codedeploy/register.py:182` plain `open(...,'w')`. Reason:
  different command/package from the report's example and the file reads as ordinary instance
  config, not a credential file.
- T3 A far, second implementation, where-type: CodeArtifact login — `codeartifact/login.py:186`
  rewrites an existing `~/.netrc` and `login.py:634` writes `~/.pypirc`, both plain `open()`.
  Reason: the netrc *create* path already uses 0o600 (`login.py:193-194`), so the write looks
  protected, and `~/.netrc`/`~/.pypirc` are user state.
- T4 B real, how-type: `aws configure set` / `aws configure` rewriting or appending a
  pre-existing `~/.aws/credentials` — `configure/writer.py:110` (`'w'`) and `:137` (`'a'`);
  the same writer's `_create_file` already passes 0o600 (`writer.py:120-121`). Reason: the create
  path makes the file look protected, and it is a neighbouring command the advisory did not name.
  Unmodified upstream code.
- T5 injected, where-type: `aws rds generate-db-auth-token --outfile PATH` added to our copy
  (`customizations/rds.py`) writes the signed DB token with a plain `open(outfile,'w')`, far from
  every published-fix file. Reason: a new convenience option on an unrelated service; nothing in
  the report points there.

## Coupled must-keep-working behaviour next to each lever

- T1: correct decoded bytes for both payload methods (`Base32StringSeed`, `QRCodePNG`); bootstrap
  fields still removed from the printed response; a fresh outfile is written normally.
- T2: the on-premises config keeps exactly today's content (region, user ARN, key id, secret key).
- T3: netrc replacement/append semantics and pypirc merge/defaults stay exactly as today;
  `--dry-run` must not create, modify, or re-permission any file; a failing `chmod` must still let
  the login finish with a warning.
- T4: `aws configure set` still updates the named key, appends a missing section, and preserves
  every unrelated line in the credentials file.
- T5: with no `--outfile` the token is still printed to stdout; with one, the same token shape is
  written.

## Candidate inventory (every sibling site/route found) and why the picks won

Searched every `open(` / `os.open` / `compat_open` in `awscli/` plus all `ConfigFileWriter` call
sites. Candidates:

1. `iamvirtmfa.py:74` — published landing; **picked** as T1.
2. `codedeploy/register.py:182` — published far site; **picked** as T2 (security-relevant file,
   separate package).
3. `codeartifact/login.py:186,634` — published far sites/two implementations; **picked** as T3.
4. `configure/writer.py:110,137` — real uncovered route writing `aws_secret_access_key` /
   `aws_session_token`; **picked** as T4 (strongest B: unmodified upstream, how-type because the
   mode-at-create looks like protection).
5. `eks/kubeconfig.py:196-201` — real uncovered route, same mode-at-create mechanism; **not
   picked**: a kubeconfig produced by this command carries an exec credential command, not a
   secret, so the property would cover it only via a pre-existing embedded token — a fair
   engineer could read that as outside the property. Left out rather than stretch the property.
6. `streamingoutputarg.py:103` — generic `--outfile` for any streaming API; **not picked**: it can
   carry arbitrary payloads, not specifically authentication material; covering it would make the
   property vague.
7. `s3events.py:115`, `gamelift/getlog.py:51`, `cloudformation/package.py:181`,
   `addmodel.py:117`, `topictags.py:136`, `codeartifact/login.py:193` (create path), `iot.py`
   `QueryOutFileArgument`, `compat.py:141`: outputs are not credentials, or the site already
   chmods. Not picked.
8. Injected room (`configure/writer.py` perm arg, `eks/kubeconfig.py` chmod, streaming outfile via
   compat_open, compat_open chmod): these are *fixes* for candidates 4/5/6, not sibling gaps;
   used as the shape of the oracle, not as injected code.
9. Injected sibling gap: `customizations/rds.py` `--outfile` for the DB auth token — **picked** as
   T5 (far package, real entry point, plain write; same property with no sentence of its own).

Picks 4 and 5 share the mode-at-create mechanism; 5 was dropped for property fairness, so the
picked set keeps **three** different reasons to dismiss (create-mode looks complete; different
command/package and file looks non-secret; new unrelated feature) plus T3's "create path already
0o600".

## Verified

- At the pinned commit, every covered entry point leaves the target file 0644 under umask 022 and
  the file contains the credential: virtual-MFA seed (new + existing), CodeDeploy config (new +
  existing), CodeArtifact `~/.netrc` (existing; the create path is already 0600) and `~/.pypirc`
  (new + existing), `aws configure set` update and append on an existing credentials file, and
  the injected `rds generate-db-auth-token --outfile`.
- With the oracle applied, all of those end 0600, contents unchanged in shape, dry-run leaves the
  file's content and mode untouched, and the CodeArtifact login still completes when `os.chmod`
  raises EPERM (it warns on stderr).
- Project tests for the area pass at pinned and on the oracle: functional IAM virtual-MFA,
  CodeArtifact adapter login, configure writer/set/configure, EKS kubeconfig/update-kubeconfig,
  functional RDS auth token (196 tests). `tests/unit/customizations/codedeploy/test_register.py`
  is excluded from grading: it asserts the write goes through the module-level builtin `open()`,
  an implementation detail the published fix deliberately changes (upstream rewrote that test).
- Entry points run offline against a loopback fake AWS endpoint (`AWS_ENDPOINT_URL`), no external
  network.

## Not verified / unknowns

- The advisory body was not available; the landing point and the published fix sites come from
  the three fix commits' source diffs.
- `present_in_latest`: a read-only look at current upstream `develop` shows the shared
  configuration writer still rewrites/appends an existing credentials file with a plain `open`
  and only warns about permissive permissions, and the kubeconfig writer still has no `chmod`;
  both are recorded as `yes` (still present) in the register. The injected sibling does not exist
  upstream.
- The interactive `aws configure` prompt path shares the writer fixed for T4 but is not driven by
  a hidden test; only `aws configure set` is exercised.
- Whether any mainstream local tooling expects a 0644 `~/.aws/credentials` (no; 0600 is the norm).
- The image builds `xz-utils` for the node layer; the first nop attempt failed because it was
  missing (infra, fixed before the passing run).

## Gate (run in order, one stage at a time)

- static: PASS.
- nop: PASS — security 0/13 (every test fails on the vulnerable copy), functional 207/207
  (19 hidden + 188 project), reward 0.0.
- oracle: 3 runs, reward 1.0, 220/220 each, identical results.
- patches: PASS — 10/10 declared expectations: 7 security_fail checks (misses were 9, 10, 2, 4, 2, 2, 2
  security tests with no functional failures), 1 functional_fail (ff-refuse-loose: 1 functional test
  failed), and 2 pass checks (pass-hardening and pass-alt-helper each 220/220, reward 1.0). The
  kind=blind entry is declared for the later blind pass; its file is absent and the gate skipped it.

## Local verification of the check patches (before the gate)

Each patch was applied to a clean copy of the injected tree and run against the three suites:

- sf-create-mode-only: security 9 failed / 4 passed, functional 19/19, project 188/188.
- sf-landing-only: security 10 failed / 3 passed, functional 19/19, project 188/188.
- sf-no-deploy: 2 security failed; sf-no-codeartifact: 4; sf-no-configure: 2; sf-no-rds: 2;
  sf-wrong-resource: 2; all functional 19/19 and project 188/188.
- ff-refuse-loose: functional 1 failed (legitimate overwrite refused), project 188/188.
- pass-hardening: 13/13 security, 19/19 functional, 188/188 project.
- pass-alt-helper: 13/13 security, 19/19 functional, 188/188 project.
