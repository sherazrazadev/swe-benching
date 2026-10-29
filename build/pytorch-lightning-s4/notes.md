# pytorch-lightning-s4 — build notes

* Started: 2026-10-29T05:13:00Z
* Last updated: 2026-10-29T06:06:38Z (final full gate PASSED)

## Candidate (verified against the code, not trusted from the screener)

* Advisory: GHSA-QQMF-GPG7-G8GW / CVE-2026-58659 / PYSEC-2026-3624 / PYSEC-2026-3967.
* Repo `lightning-ai/pytorch-lightning`; pinned `8116c5d7fed26994c0d4f10f0e56e57386ab0949`; published fix
  `d710d689510d50e800f53b3cd773cbca20b1f86f` (only parent).
* The published fix restricts the `_instantiator` value carried by a checkpoint to two built-in
  import paths. Reproduced on the pinned tree through `LightningModule.load_from_checkpoint`: the
  value is imported and called.
* The project's own `tests/tests_pytorch/core/test_saving.py` passes on the pinned tree
  (16 passed, 16 skipped, offline). The fix's two regression tests are absent from the pinned tree.

## The one security property (written before choosing routes)

"A checkpoint may supply data for the library's own rebuilding logic to interpret; it may never
supply the logic itself. Other than the library's existing restoration of an object's own class and
the classes of its typed constructor arguments, no value in a checkpoint may cause the library to
import or call code that the checkpoint names. A checkpoint containing such a value must be refused
before anything it names is imported or called, however that value is placed in the checkpoint and
wherever the library rebuilds an object from a checkpoint."

Every security test below is an instance of that sentence; no test has a rule of its own.

## Levers (one line each)

* **L1 (T1) — how-type/merged sources:** the reported sink is one construction-argument dict fed by
  the current settings key, `hparams`, `module_arguments` and the datamodule's key; a check placed at
  the checkpoint read misses the later merges. `src/lightning/pytorch/core/saving.py:156-161`.
  Reason to dismiss: the other three are "legacy" / "datamodule" bookkeeping, not the field the
  report shows.
* **L2 (T2) — how-type/coupled must-keep-working:** the product writes the reserved marker into its
  own checkpoints and must still call its built-in instantiator to restore the saved class and
  nested typed arguments. A fix that deletes/ignores the marker, or drops the saved class path,
  breaks the library's own round-trip. `src/lightning/pytorch/core/saving.py:167`,
  `src/lightning/pytorch/cli.py:886-903`. Reason to dismiss: "the marker is the vulnerable thing,
  so refusing it everywhere is safest."
* **T3 — injected, route where protection never existed:** the legacy hyperparameter-container
  conversion imports a dotted container name. `src/lightning/pytorch/core/saving.py:212-218`.
  Reason to dismiss: "that is a type conversion for old checkpoints, not an instantiator."
* **T4 — injected, second entry point in another file:** the command line tool's checkpoint
  configuration restore imports and calls a recorded migration. `src/lightning/pytorch/cli.py:573-577`.
  Reason to dismiss: "the CLI path is an operator tool that already loads with `weights_only=True`,
  and the report is about `load_from_checkpoint`."

## Full candidate list and why the picks won

Screener O8 leads:
1. `_class_path` + the allowlisted instantiator (`cli.py` `instantiate_module`); arbitrary class
   import survives the allowlist. **Rejected as a security route.** Upstream's own test
   `test_lightning_cli_load_from_checkpoint_dependency_injection_subclass_mode` calls
   `LightningModule.load_from_checkpoint` on a checkpoint whose `_class_path` is the concrete user
   class and requires it to construct. A fix that blocks checkpoint-selected classes breaks that
   test, so the property explicitly preserves "the object's own class and typed argument classes".
   The tension is used as T2 (coupled functional) instead.
2. `LightningCLI --ckpt_path` rebuilds the model from `_class_path`/`dict_kwargs`. **Rejected for the
   same reason** (`test_lightning_cli_ckpt_path_argument_hparams_subclass_mode` requires the
   checkpoint to select a subclass of the operator's base). Used as part of T2's preservation.

Own search for other sites/routes at pinned:
3. `_load_state` reads the datamodule's key through the same sink — kept as T1's fourth route.
4. `hparams` / `module_arguments` legacy keys merge into the same dict — kept as T1.
5. `hparams_file` (YAML/CSV) overwrites the settings dict before the sink — **rejected**: the file is
   operator-supplied, so the untrusted-checkpoint threat does not cover it; kept as a functional
   preservation test.
6. `**kwargs` override on `load_from_checkpoint` — **rejected** for the same reason (caller-supplied).
7. `CHECKPOINT_HYPER_PARAMS_TYPE` called as a callable (`_convert_loaded_hparams`) — at pinned it is
   either a type object or a string mapped to `AttributeDict`; with `weights_only=True` a callable
   cannot be carried, so no attack at pinned. **Became T3 by injection** (dotted legacy container).
8. `weights_only=False` default for remote-URL checkpoints (`fabric/utilities/cloud_io.py:60-66`) —
   a real hardening gap but needs network at run time and is a different protection (safe
   deserialization). **Rejected**: offline requirement.
9. `upgrade_checkpoint` module `torch.load` — same pickle-only vector under the current torch
   default; no string-to-import sink. Rejected.
10. `loggers/utilities.py` `_class_path` filtering — bookkeeping only; no import. Rejected.
11. `instantiate_class` for optimizers/schedulers (`cli.py:815-827`) — reachable only through CLI
    config, which is `_class_path`-style legitimate configuration. Rejected as a route; covered by
    T2's preservation.
12. Fabric `_ClassReplacementContextManager` / accelerator registry `importlib.import_module` — the
    input is internal registration data, never a checkpoint. Rejected.
13. A non-string `_instantiator` (list/dict): at pinned the set-membership test raises `TypeError`,
    so no code runs. Not a security lever; the oracle still returns a clean `ValueError` (hardening).

Injected gaps considered:
14. A second reserved construction key resolved next to `_instantiator` in `_load_state` — **not
    picked**: adjacent to the reported line, a grep for the sink finds it immediately.
15. A checkpoint-recorded hparams transform in `_load_from_checkpoint` — **not picked**: same file,
    same concept as T3/T4, and weaker (the report already leads into that function).
16. A provenance flag written by the producer and required at load — **not picked**: an attacker can
    copy the flag, so a correct fix cannot rely on it; unfair as a test.
17. A dotted hyperparameter-container name in `_convert_loaded_hparams` — **picked as T3**: different
    function, plausible legacy support, no upstream protection, and the coupled legitimate value
    (the legacy plain container name) makes an over-broad refusal testable.
18. A configuration-migration hook in `LightningCLI._parse_ckpt_path` — **picked as T4**: different
    module and entry point, upstream's fix never touches it, and the existing `_instantiator` pop
    makes "one more marker the restore honours" plausible.
19. A registry/alias indirection for instantiators — **not picked**: nothing in the codebase supports
    it, so the injection would look planted.

## What was verified

* Every security route executes on the injected baseline (marker written) and is refused with no
  marker on the oracle.
* All functional tests pass on the injected baseline and on the oracle, including the project's own
  `tests/tests_pytorch/core/test_saving.py`.
* The check patches behave as declared: `sf-published-only` 2 security fail, `sf-new-key-only`
  5 security fail, `sf-no-hparams-type` 1, `sf-no-cli-hook` 1, `sf-exit` 4 (security),
  `ff-ignore-instantiator` 3 functional fail, `ff-dotted-scan` 6 functional fail, and both pass
  patches score 1.0.
* Runs were made offline against the mounted trees in a CPU-only Python 3.12 image with torch, the
  project installed editable, `jsonargparse[signatures,jsonnet]` and pytest.

## What I could not verify

* The two target models were not run (the build stage is not allowed to run trials), so the bar is
  a design target, not a measurement.
* `pytorch_lightning.cli.instantiate_module` is a different function object from
  `lightning.pytorch.cli.instantiate_module`; the alternative pass patch accepts both. A fix that
  keeps only the modern spelling would refuse checkpoints recorded by older versions; no test
  forces that legacy spelling because it would be a pure spelling variant.
* Whether current upstream still has any of the injected shapes: they are ours, so "present in
  latest" is not meaningful for them; the real routes are unmodified upstream code at the pinned
  commit.

## Fairness notes

* The property's exemption ("the object's own class and typed argument classes") is what keeps the
  upstream CLI round-trip legitimate. Without it the task would be unfair (no fix can both block
  arbitrary classes and keep the upstream test).
* A blind engineer can find all four levers from the instruction plus the code: the loader has three
  string-to-import sites and the CLI restore one; the coupled functional behaviour is visible in the
  project's CLI producer and in `tests/tests_pytorch/test_cli.py`.
* No test calls product code to compute its expected value or to clean up; the marker file and all
  checkpoints are built in the test process.
* Scope note: the remote-URL `weights_only=False` default and the unsafe YAML loader for a
  caller-supplied settings file are real hardening gaps outside this advisory's protection; they are
  not covered and not built on.

## Gate results (2026-10-29)

* `--only static`: PASS (conformance, no instruction leaks, 476-word instruction).
* `--only nop`: PASS. Security 0/6 (every attack succeeded on the injected baseline), functional
  24/24 (8 hidden + 16 project; the project's GPU/MPS cases are deselected, not skipped, so the
  threshold scorer sees no skipped functional test).
* `--only oracle`: PASS, three runs, each security 6/6 and functional 24/24, reward 1.0.
* `--only patches`: PASS 9/9.
  * `sf-published-only` 4/6 security (leaves the container conversion and CLI restore open).
  * `sf-new-key-only` 1/6 security (leaves the legacy keys, datamodule and both injected gaps open).
  * `sf-no-hparams-type` 5/6, `sf-no-cli-hook` 5/6 (one injected sibling each).
  * `sf-exit` 2/6 (SystemExit is not the ordinary error the contract requires).
  * `ff-ignore-instantiator` reward 0.0, three CLI round-trip failures, security all pass.
  * `ff-dotted-scan` reward 0.0, six functional failures, security all pass.
  * `pass-hardening` and `pass-alt` reward 1.0.

## Late fairness fix

The first draft of the instruction had a preservation bullet saying older checkpoints keep loading
"as they do today". The injected container conversion claims to be legacy support, so that sentence
could be read as endorsing the vulnerable import and contradicted the container security test. It
was removed. The remaining legacy-container functional test (a plain, non-dotted name) is covered by
the standard "keep every legitimate use working" constraint and by the code's existing non-dotted
branch, so it is not a hidden requirement.

## Known fairness tensions

* The container route (T3) requires an ordinary error for a dotted container name. A fix that
  silently maps every string container to the legacy type stops the code but does not follow the
  stated refusal contract and fails; the contract is explicit, so this is a real scope test rather
  than a trap.
* The CLI restore route (T4) is the hardest scope test: it sits in a different module from the
  reported import and is reached through a checkpoint used to restore a run's configuration. The
  property says "wherever the library rebuilds an object from a checkpoint", and the code path is
  reachable and readable.
* `_class_path` class selection (the screener's O8 routes 1 and 2) is deliberately outside the
  protection because upstream's own tests require it; the preservation contract keeps it working.

## Full gate

`python3 -I common/gate/gate.py pytorch-lightning-s4` (stages in order) exited 0:
static PASS, nop PASS, oracle PASS (3 trials, reward 1.0 each), patches PASS (9/9 checks as
declared). Report: `build/pytorch-lightning-s4/gate_report.json` (final run finished 2026-10-29T06:06:38Z).
The `blind` pass patch and `FAIRNESS.md` are intentionally not written here; later stages own them.
