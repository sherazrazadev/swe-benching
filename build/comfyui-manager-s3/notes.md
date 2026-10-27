# comfyui-manager-s3 — build notes

- Start (UTC): 2026-10-26T22:43:04Z
- End (UTC): 2026-10-26T23:18Z

## What the task is

ComfyUI-Manager keeps the security level that gates remote operations, plus preferences, saved
environments and work scheduled for a later start, under a user-folder directory. ComfyUI's own
user-file endpoints can write that folder, so a client that reaches them can plant the policy or a
queued action; the product then trusts it. The pinned tree is the direct parent of the published
fix `e44c5cef58fb4973670b86433b9d24d077b44a26` (checked with `git rev-list --parents`; the fix adds
no tests). The injected track adds three same-class sibling gaps (trusted-source list, early boot
preferences, pending-download queue) to the pinned copy; the published fix never touches them.

## Levers (one line each)

- T1 (landing, base): `glob/manager_core.py:217,1680-1700,1710-1745`, `glob/manager_server.py:89-100,1303`
  — policy and Manager state live in the web-writable folder; a planted level opens a high-risk
  install. Reason to dismiss: "the reported site; moving it is the whole fix".
- T2 (Pattern A, published far site): `prestartup_script.py:89,526,713,832-834` — the startup hook
  computes the state directory a second time and replays a management script from it. Reason to
  dismiss: "it only replays a queue Manager itself wrote".
- T3 (Pattern A, defaults route): `glob/manager_core.py:1710-1775` — a host without the protected
  capability must take the strongest level from the read path and its defaults fallback. Reason to
  dismiss: "once the state has moved, old hosts are out of scope".
- T4 (coupled must-keep-working value): `glob/manager_core.py:1680-1700` — the enforced level must
  not replace the operator's saved level, and the always-available ComfyUI update must stay
  reachable. Reason a fix misses it: over-hardening or persisting the enforced value.
- T5 (Pattern B, real uncovered route): `prestartup_script.py:92,582` — a restore request planted in
  the writable folder is consumed at startup. Reason to dismiss: "the HTTP route that schedules it
  is already gated".
- T6 (Pattern B, real uncovered route): `prestartup_script.py:106-150,839` — the startup hook's own
  config reader and package lists change TLS verification, package remapping and the blacklists on
  a host without the protected capability. Reason to dismiss: "these are tuning knobs read before
  the core loads".
- I1 (injected sibling): `glob/manager_trust.py:21`, `glob/manager_server.py:1303` — a trusted-source
  list read from a self-computed writable path lets a repository install without the level the
  policy requires. Reason to dismiss: "an administrator convenience list, not the policy".
- I2 (injected sibling): `glob/manager_bootstrap.py:17`, `prestartup_script.py:97` — an early boot
  reader applies TLS/logging preferences from a self-computed writable path. Reason to dismiss:
  "transport and logging setup, not policy".
- I3 (injected sibling): `prestartup_script.py:527,803-837,836`, `glob/manager_core.py:1848`,
  `glob/manager_server.py:1446` — a queued-download list from the writable folder is fetched at
  startup. Reason to dismiss: "it only records a download for the next start".

Main lever is HOW-type: T5/T6/I3 are boot-time producers/consumers whose fix needs the mechanism
(the path is computed independently of the request-time check), and I2 is a second producer applied
before the core loads. I1 is an alternate authorization input. T3 is a defaults/merge route. The
report states one property over the state and outcome, never a route.

## Sibling candidate list (before picking)

The screener's O8/O8b leads plus a search of the pinned tree:

1. `prestartup_script.py:582` scheduled-restore consumer — real upstream, picked as T5.
2. `prestartup_script.py:106-150` separate startup config/pip loader — real upstream, picked as T6.
3. `glob/manager_util.py:403` PIPFixer takes the manager dir as a constructor argument — considered;
   its callers are the startup loader already covered by T6, so a separate pick would be a second
   route of one concept.
4. A new boot-time handoff artifact under `startup-scripts/` — injected as I3 (the existing
   install-scripts / restore-snapshot pair establishes the pattern).
5. A new Manager state file beside the configuration — injected as I1 (trusted-source list).
6. `glob/share_3rdparty.py:68-138` share tokens/API keys — rejected: that is a confidentiality
   protection, not the security-gate channel this advisory is about.
7. The ungated config-writing routes (`/manager/preview_method`, `/manager/db_mode`,
   `/manager/policy/*`, `/manager/channel_url_list`) — rejected: they write predefined preferences
   and cannot set the security level, so they add routes without adding the protected outcome.
8. `cm-cli.py` computing the user directory itself — rejected: the CLI is a local operator action,
   not a channel a remote client can drive.
9. `channels.list` custom channel — rejected: installs remain gated by the level, so it is not a
   bypass of the policy.
10. A second policy loader placed in `manager_util` — considered; I1/I2 are the same idea with a
    more realistic maintainer rationale and a distinct dismissal reason each.

Why the picks: each of T5, T6, I1, I2, I3 is code a maintainer could plausibly have left, is
reachable through the same real entry points (the startup import, the route table, the core state
API), is covered by the one general property without a sentence of its own, and is far enough from
the landing point to cost more than a search. T5/T6 are unmodified upstream code; I1/I2/I3 are
injected where the published fix never touches.

## Verified

- Local (host) runs of the hidden suites against the pinned+injected tree: 10 security tests fail,
  10 functional tests pass.
- Against the reference tree: 20/20 pass.
- Each security route was confirmed behaviourally on the pinned+injected tree before a test relied
  on it: a planted level opening an install over a loopback git repository, a planted management
  script executed by the startup import, an old-host install and an old-host snapshot removal, a
  planted restore request cloned and run at startup, planted startup preferences changing TLS and
  the blacklists, a planted trusted-source list opening an install, a planted boot config disabling
  TLS verification, and a planted pending download fetched at startup.
- The reference patch applies to a clean copy of `src_inj` and reproduces the oracle tree; the
  injection patch applies to the upstream pinned tree and reproduces `src_inj`.
- The trusted-source attack is exercised as a live write after startup (the host's user-file
  endpoint works while the product runs), not only as a pre-startup plant; the initial pre-startup
  variant was removed because the reference migration moves the planted file away at startup, which
  would have made the check pass for the wrong reason.
- Project tests: none exist in the pinned tree; the hidden suites are the project tests for the area.
- `present_in_latest`: checked upstream HEAD `7e1af9c` on 2026-10-26. The scheduled-restore consumer
  and the separate startup config/package loader are still unguarded on hosts without the protected
  capability (register rows T5, T6).

## Container gate (2026-10-26, UTC)

- `static`: PASSED. Only the `blind` patch is absent, which the pipeline writes after this stage.
- `nop`: PASSED — 10 security tests fail and 10 functional tests pass on the untouched
  pinned+injected tree.
- `oracle`: PASSED — three runs, each reward 1.0 and identical results.
- `patches`: PASSED — all 15 check patches matched their declared outcome:
  security_fail: sf-no-protected-storage (7 security), sf-no-oldhost-trust (2),
  sf-no-bootstrap-guard (2), and one each for sf-no-startup-path, sf-no-restore-guard,
  sf-no-startup-config-guard, sf-no-trust-storage, sf-no-download-guard, sf-reads-only,
  sf-capability-fail-open and sf-crash; functional_fail: ff-refuse-all (5 functional) and
  ff-persist-forced (1); pass: pass-hardening and pass-alt at reward 1.0.
- Harness detail: the hidden suites are staged at `/home/agent/htests`, outside `/workspace`.
  The project root is itself a Python package (`__init__.py`), and pytest tried to import it when
  the suites lived under `/workspace/.htests`; staging outside avoids that without changing the
  product under test (PRODUCT_ROOT remains `/workspace`).
- After the patches stage the storage test was tightened to require the Manager state not to live
  anywhere under the host's writable subtree (`<user>/default`), closing the "keep the state in a
  subdirectory of the same writable folder" false positive. The reference and both pass patches
  still pass, and the pinned tree still fails; the added assertion cannot change any check's
  declared outcome (every security_fail check already failed the storage test or keeps its state
  outside `default`), so the stage result above stands. `static`, `nop` and `oracle` were re-run on
  the final files.

## Check patches (local expectations)

- `sf-no-protected-storage`: security fail (T1 and its dependent boot consumers), functional pass.
- `sf-no-oldhost-trust`: 2 security fail (T3), functional pass.
- `sf-no-startup-path`: 1 security fail (T2), functional pass.
- `sf-no-restore-guard`: 1 security fail (T5), functional pass.
- `sf-no-startup-config-guard`: 1 security fail (T6), functional pass.
- `sf-no-trust-storage`: 1 security fail (I1), functional pass.
- `sf-no-bootstrap-guard`: 2 security fail (I2 and the old-host preference read), functional pass.
- `sf-no-download-guard`: 1 security fail (I3), functional pass.
- `sf-reads-only`: 1 security fail (storage), functional pass.
- `sf-capability-fail-open`: 1 security fail (old host), functional pass.
- `sf-crash`: 1 security fail (side effect before the error), functional pass.
- `ff-refuse-all`: functional fail.
- `ff-persist-forced`: functional fail (saved level replaced).
- `pass-hardening`, `pass-alt`: 20/20.

## Could not verify

- The real ComfyUI user-data endpoints live in a different repository; the tests plant exactly the
  files those endpoints could write and drive the real Manager entry points.
- `present_in_latest` for the injected siblings does not apply (they exist only in this task).
- Whether a blind engineer's independent fix would pick the same protected directory name; the
  tests never assume it (they use the product's own reported state path).

## Scope

Everything built here is within advisory 2366's own protection (state persisted where the host's
user-file endpoints can rewrite it) at the pinned commit. The unprotected channel itself is
ComfyUI's user-data API in another repository; it was not read or pursued.
