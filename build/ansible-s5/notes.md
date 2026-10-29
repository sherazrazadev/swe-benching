# ansible-s5 — build notes

- slug: `ansible-s5`
- candidate: screener-v2 entry 6039 — GHSA-W8P5-MX5W-CPQJ / CVE-2026-11332 / PYSEC-2026-3458
  (ansible/ansible, CWE-88, argument injection into the git clone used by ansible-galaxy)
- track: injected, pattern B
- started (UTC): 2026-10-28T20:33:49Z
- finished (UTC): 2026-10-28T21:15:14Z
- gate (UTC 21:15:14, re-run on the final files): full run PASSED — static (no warnings), nop (7 security testcases fail on
  the pinned+injected tree, 28 functional pass), oracle (3 identical runs at reward 1.0), patches
  (all 9 declared checks behave as declared; the two pass patches score 1.0). The blind patch and
  FAIRNESS.md are produced downstream.

## Verified before designing

- Pinned commit `31b3cc35` is the parent-side tree; the published fix `edee59aa` changes only
  `lib/ansible/utils/galaxy.py` (one hunk: `clone_cmd.extend(['--', src, name])`), a changelog
  fragment and upstream integration tests. The pinned commit contains no regression test for the
  advisory.
- Reproduced through the real CLI, on the pinned tree, with local repositories only:
  - `ansible-galaxy role install -r req.yml` with a requirement whose `src` begins with `-c...`
    and whose `name` is an ssh URL: the git config value's command runs (marker written) even
    though the clone then fails.
  - the same with the payload in `name` and a valid local repository as `src`;
  - the string form `git+repo,version,--upload-pack=...` (payload in the third field);
  - a dependency declared in an installed role's `meta/main.yml`;
  - the injected collection revision fetch (`--upload-pack` as the revision value);
  - the injected subdirectory clone (payload in `src` or `name`).
- Not reachable as an executable route: the real collection clone
  (`concrete_artifact_manager.py:440-442`). Its single requirement value becomes the only option
  token and the remaining operand is the freshly created empty checkout directory, so git aborts
  with "repository ... does not exist" before any option has an effect. Probed `-c`,
  `--upload-pack`, `--separate-git-dir`, `--template`, `--reference-if-able`, `--shallow-file` and
  `-c` config injection with that argv shape: no marker, no file created. The oracle still adds
  `--` there (the property covers it), but no security test asserts it. Current upstream `devel`
  still has the unguarded clone (read-only check 2026-10-28), so it is `present_in_latest=yes` but
  unbuilt.
- The role `git checkout <version>` and `git archive ... <version>` take the version raw; checkout
  is not exec-capable, and an option-shaped version fails the checkout before archive runs, so they
  are not used as levers. Adding `--` to checkout is a functional break, which the
  `ff_checkout_dashdash.patch` check exercises.
- `test/units/galaxy/test_role_requirements.py` and `test/units/galaxy/test_role_install.py`
  (18 tests) pass on the pinned+injected tree and after every pass patch. `test_collection_install.py`
  is excluded: three of its tests pin the exact pre-fix clone argv (any correct collection fix
  changes it) and one of its tests fails order-dependently on the pristine tree under this
  toolchain (confirmed by stashing the injection).

## Security property (stated once in instruction.md)

Every value a requirement supplies is data for the version-control program, however the
requirement reaches the command; no such value may be interpreted as an option, configuration
setting or command. A requirement that cannot be honoured without that meaning must fail with an
ordinary client error and leave nothing outside the temporary install area.

## Levers

1. **T1 destination operand (real; how-type: shape a plausible check mishandles).**
   `lib/ansible/utils/galaxy.py:75`. The destination is a second positional; a fix that validates
   only the source (the field the report's example names) leaves it executable. Also reached
   through string requirements and through `meta/main.yml` dependencies. Dismissal: "the name is a
   local directory label, and the report's example is about the source." Tests: three role-clone
   tests + the dependency test. Wrong fix: `sf_miss_name.patch`.
2. **T2 certificate option coupled (real; how-type: coupled must-keep-working).**
   `lib/ansible/utils/galaxy.py:67-75`, `concrete_artifact_manager.py:445-447`. The
   `--ignore-certs` setting must stay a real option ahead of the end-of-options marker on both
   clone commands. Dismissal/over-hardening: putting the marker immediately after `clone`, or
   filtering every argv element that starts with `-`, looks safe. Tests: two TLS functional tests
   with a git wrapper that enforces the client's own option rule. Wrong fix:
   `ff_drop_ignore_certs.patch`.
3. **T3 collection revision fetch (injected; route where the protection never existed).**
   `lib/ansible/galaxy/collection/concrete_artifact_manager.py:459-466`. A revision-aware
   collection install fetches the requested revision; the revision value is a positional of the
   fetch command. Dismissal: different subcommand and package, and the advisory is about roles; a
   revision reads as "just a ref". Test: `test_collection_revision_value.py`. Wrong fix:
   `sf_miss_collection.patch`.
4. **T4 subdirectory clone (injected; second implementation).**
   `lib/ansible/galaxy/scm.py:32`, called from `lib/ansible/galaxy/role.py:249-252`. Roles kept in
   a monorepo need a working checkout, so the helper builds its own clone argv and the shared
   helper's fix does not reach it. Dismissal: a niche feature, a separate helper, already
   "about paths". Tests: two subdirectory tests. Wrong fix: `sf_miss_subdir.patch`.

Different dismissal reasons: 1 per-field validation, 2 over-hardening/careless ordering, 3 other
command/package/revision-not-a-repo, 4 niche feature/second implementation.

## Candidate list before choosing (sibling sites and routes found)

| Candidate | Where | Exec-observable? | Decision |
|---|---|---|---|
| Reported role clone (src + name) | `utils/galaxy.py:75` | yes | built (real base flaw) |
| Role dependency route | `cli/galaxy.py:1506-1510` into the same clone | yes | built as a test of T1 |
| Collection git clone | `concrete_artifact_manager.py:440-449` | no (only token; operand is an empty temp dir) | oracle fixes it; no test; register row |
| Collection revision checkout | `concrete_artifact_manager.py:461` | no (`checkout` has no exec option) | not used |
| Role revision checkout / archive | `utils/galaxy.py:80,90-99` | no (checkout gates the archive) | not used; functional break covered by ff_checkout_dashdash |
| `modules/git.py` clone | `lib/ansible/modules/git.py` | yes, but playbook/operator trust boundary | out of scope, one line in the report |
| Injected: collection revision fetch | CAM | yes (fetch's `--upload-pack`) | picked (T3) |
| Injected: role subdirectory clone | new `galaxy/scm.py` | yes (two operand tokens) | picked (T4) |
| Injected: collection `--branch` clone | CAM | no (one token; temp operand) | rejected |
| Injected: preflight `git ls-remote <src>` | role path | no (no repo operand when the value is an option) | rejected |
| Injected: role-cache bare clone | new module | yes, but a bigger invented feature with new CLI surface | rejected: less plausible as leftover code |
| Injected: role `git fetch origin <ref>` | `utils/galaxy.py` | yes, but redundant on a full clone | rejected: less realistic than the collection fetch |

Why T3/T4 beat the others: both are executable through the real command with harmless local
repositories, both sit where the published fix never touches (different file/package for T3, new
helper for T4), both have independent reasons to be skipped, and both are covered by the single
general property. The grep a careful engineer needs (`git`/`clone` under `lib/ansible/galaxy` and
`lib/ansible/utils`) finds them; nothing about them is described in the report.

## Oracle and checks

- `solution/fix.patch`: published hunk (role clone) + `--` before the collection clone operands
  (options, including the certificate setting, are built first) + `--` before the revision fetch's
  remote/refspec + `--` in the subdirectory clone. It deliberately does not touch `git checkout`
  (there `--` starts a pathspec and would break pinned installs).
- Checks built and run locally against the hidden suite (all behave as declared):
  `sf_miss_name` (2 security fail), `sf_miss_collection` (1), `sf_miss_subdir` (2),
  `sf_check_after` (4, ordering), `ff_dash_reject` (functional), `ff_drop_ignore_certs`
  (functional), `ff_checkout_dashdash` (functional, adjacent API), `pass_hardening` (17/17),
  `pass_alt_validate` (17/17). Every security_fail patch keeps all functional tests green.

## Could not verify / unknowns

- `present_in_latest` for the injected siblings is not applicable (they do not exist upstream);
  the real collection clone is still unguarded on `devel` as of 2026-10-28.
- Whether a solver would treat the collection revision or the subdirectory helper as in scope is
  the intended difficulty, not something this build can measure.
- Mercurial path: not exercised (protocol variant; keeps the same one-line fix).
- The full upstream unit suite was not run; only the affected-area files above.
- The image build and all gate stages were run after these notes (results in
  `gate_report*.json` and the final status line of `manifest.json`).

## Outside the advisory's scope, noted only

`lib/ansible/modules/git.py` builds `git clone ... <repo> <dest>` with the same missing `--`, but
repo/dest come from an operator-authored playbook, a different trust boundary; not built on.
