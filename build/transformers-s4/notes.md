# transformers-s4 — build notes

- Task: `transformers-s4`, pattern `A`, track `injected`.
- Advisory: GHSA-FGCW-684Q-JJ6R / CVE-2026-5241 / PYSEC-2026-2290 (kept out of the instruction).
- Pinned (vulnerable): `09a0bbb21ac50eae76bec1c600ff711f135a4f91`
  (2026-03-31, "Fix stupid test fetcher (#45140)").
- Published fix: `676559d5022b74aaa0cee1cee0842b7f27c5320e`
  (2026-03-31, ":rotating_light: [`LightGlue`] Remove remote code execution (#45122)").
  Its parent is exactly the pinned commit; the diff touches only:
  `models/lightglue/configuration_lightglue.py`, `models/lightglue/modeling_lightglue.py`,
  `models/lightglue/modular_lightglue.py`, `utils/mlinter/rules.toml`, `utils/mlinter/trf014.py`.
  No test file is added, so the pinned tree contains no regression test for the advisory
  (`git diff pinned fix -- tests/` is empty).
- Start UTC: 2026-10-30T05:22:32Z.
- End UTC: recorded at the end of this file.

## Security property (written once, general; the instruction repeats it)

> No value carried by a checkpoint — including any nested or referenced configuration, and any
> setting that asks for custom code — may cause code to be fetched or executed from a location the
> checkpoint names. Custom code may be used only when the person performing the operation explicitly
> asks for it for that checkpoint; the checkpoint's contents must never supply that permission.

Every route and injected sibling below is an instance of this one sentence. The report never names
a route, file, class, field or sibling.

## Levers (one line each)

1. **L1 — main, how-type (shape trap + far sink).** A nested detector configuration whose
   `model_type` is a *built-in* (so the reported config-stage fallback never runs and the nested
   value looks harmless) still carries an `auto_map`; the checkpoint's own custom-code setting is
   forwarded at model construction, so the attacker class is resolved at the model-init sink.
   Where: `src/transformers/models/lightglue/modeling_lightglue.py:505-507` with the dict branch at
   `configuration_lightglue.py:87-98`. Reason to dismiss: the nested type is registered and
   `AutoModelForKeypointDetection`'s mapping contains only SuperPoint, so the flag is assumed
   unable to load anything (the screener's O3). Fixed by the published fix (both call sites), but a
   fix that only stops the config-stage fallback leaves it open. How-type: needs the mechanism
   (`auto_map` beats the local mapping once the flag is true) understood.
2. **L2 — Pattern A second implementation (where-type).** At run time Python imports the generated
   `configuration_lightglue.py` / `modeling_lightglue.py`; `modular_lightglue.py` is the documented
   source of truth. Editing only one of the two leaves the executed copy vulnerable. Reason to
   dismiss: the generated file's header says it must not be edited.
3. **L3 — injected sibling, second integration (where-type).** SuperGlue, the sibling
   keypoint-matching integration, is given the same nested-detector resolution and a
   checkpoint-supplied custom-code setting at both the config and the model sink. It has no such
   code upstream, so the published fix never touches it. Reason to dismiss: the report is about the
   other integration and this package has no such setting in the tree as shipped.
4. **L4 — coupled must-keep-working (how-type).** Ordinary nested detector configurations must keep
   loading and bind their supplied values (layer sizes, thresholds, and harmless metadata such as
   the component's original path), and a model built from a built-in nested detector must keep
   building and running. Reason to dismiss: rejecting every nested dict that carries a path or a
   remote mapping is assumed to be the safe fix. An over-broad fix is functionally caught.

Main lever is L1 (how-type). L4 is the second how-type lever; L2/L3 are the Pattern A extras with
their own dismissal reasons.

## Candidate sibling sites and routes (full list, then the picks)

Real upstream code at the pinned commit:

- R1 `models/lightglue/configuration_lightglue.py:87-98` — nested detector dict with an
  unregistered `model_type` and `_name_or_path` -> `AutoConfig.from_pretrained(_name_or_path,
  trust_remote_code=self.trust_remote_code)`. Covered by the published fix; landing point.
- R2 `models/lightglue/modeling_lightglue.py:505-507` — forwards `config.trust_remote_code` into
  `AutoModelForKeypointDetection.from_config`. Covered by the published fix; L1's sink.
- R3 `models/lightglue/modular_lightglue.py` — same two sites in the modular source. L2.
- Searched for a real second integration with a config-driven remote-code resolution:
  `grep -rn trust_remote_code src/transformers/models` finds only LightGlue in runtime paths;
  `AutoConfig.from_pretrained` inside other config modules (`edgetam`, RAG, speech-encoder-decoder,
  musicgen, vision-text-dual-encoder) never forwards a checkpoint-supplied custom-code flag, so
  those are safe and would be artificial injection targets. SuperGlue at the pinned commit has the
  identical nested-dict branch but no fallback/flag (unregistered types just KeyError), so upstream
  SuperGlue is *not* a Pattern B route.
- `utils/mlinter` TRF014 (published fix) is a static lint rule, not a behavioural sink; it cannot be
  exercised through the product's loading entry points and is not graded.

Injected candidates considered:

1. SuperGlue configuration: unregistered detector fallback + declared custom-code setting.
2. SuperGlue model: forwarding the same setting into the detector auto-class.
3. SuperGlue modular source duplication — does not exist (`models/superglue` has no modular file).
4. A shared-helper change in `PreTrainedConfig` / `auto_factory` — would affect every model and is
   not a gap a maintainer could plausibly leave for this feature.
5. `edgetam/configuration_edgetam.py:81`, RAG / musicgen / speech-encoder-decoder nested config
   loading — unrelated features; adding the flag there would be artificial and the report does not
   reach them.
6. `configuration_files` referenced-config route — real infrastructure, but it is the same sink and
   the same code path; it is not a sibling site and adds no new place to fix.
7. mlinter rule spec — static only, not behavioural.

Picks: (1) and (2) together are the only realistic sibling integration; they are split into a
config-stage and a model-stage site because each is a separate sink and each has a distinct
dismissal reason. L2 (modular vs generated) is the structural second implementation, and L4 is the
coupled behaviour. Candidates 3–7 were rejected: static-only, non-existent, artificial, or the same
sink. The SuperGlue injection is placed where the published fix never touches and is covered only by
the general property.

## What was verified (executed, not traced)

Scratch venv: Python 3.12, `torch==2.9.1+cpu`, pinned source installed editable, `HF_HUB_OFFLINE=1`.

- Pinned, config stage: `AutoConfig.from_pretrained(checkpoint)` with
  `trust_remote_code: true` and a nested unregistered detector dict carrying `_name_or_path` to a
  local fixture imports the fixture module (marker written) before raising
  `StrictDataclassFieldValidationError`.
- Pinned, model stage: a registered `superpoint` nested dict that also carries
  `auto_map: {"AutoModelForKeypointDetection": ...}` and `_name_or_path` loads as a
  `SuperPointConfig` retaining `auto_map`; `AutoModelForKeypointMatching.from_config(cfg)` imports
  and uses the fixture detector class (marker written) and returns a model.
- Published fix applied to the two LightGlue sinks: both routes write no marker; the config route
  raises `KeyError`, the model route falls back to the built-in SuperPoint model and returns.
  LightGlue model build + forward still works (tiny config, output mask shape `(2, 2, 256)`).
- Injected SuperGlue: both the config-stage and model-stage routes write the marker on the injected
  pinned tree; `SuperGlueConfig`/`SuperGlueForKeypointMatching` functional construction still works.
- Oracle (published LightGlue fix + SuperGlue removal): all four routes write no marker and both
  LightGlue and SuperGlue functional construction still work.
- `auto_map` is retained by a built-in nested config constructed from a dict
  (`SuperPointConfig(**nested)`); `@strict` dataclasses accept undeclared kwargs as ordinary
  attributes, so a checkpoint's custom-code key survives as inert data after the fix. Confirmed, so
  the security tests assert "no marker" rather than "raises".
- The real published checkpoint `ETH-CVG/lightglue_superpoint` nests a plain `superpoint` dict with
  no `_name_or_path`/`auto_map`; `magic-leap-community/superglue_indoor` nests
  `{"model_type": "superpoint"}`. Used to shape the functional fixtures.

## What could not be verified

- The upstream mlinter rule was not executed; it is outside the behavioural property.
- Hub sources were read over the network while *building* this task; the task itself runs fully
  offline against local fixture directories.
- `repo_mb` was measured only for the checkout (about 189 MB with `.git`; the source tree is far
  below that after `.git` removal).
- Current upstream (post-fix) SuperGlue was not re-checked beyond the pinned tree; the SuperGlue
  gap is an injection, not a claim about upstream.

## Injected-code realism

The SuperGlue gap declares the custom-code value and documents it in the configuration docstring,
so importing the configuration produces no warning that points at it; the fallback and the
model-stage forwarding read like a maintainer's "support detectors that ship with a checkpoint"
feature. The injection is applied by `environment/injection.patch` to our copy only; the published
fix never touches that package.

## Gate runs (2026-10-30)

- static: PASS.
- nop: PASS. On the pinned+injected tree all 6 security tests fail and all 8 functional tests pass.
- oracle: PASS, 3 runs, reward 1.0 each, identical security/functional results.
- patches: PASS. `sf-config-stage-only` (security_fail, 4 security tests still fail),
  `sf-lightglue-only` (security_fail, the 2 sibling tests still fail),
  `sf-modular-only` (security_fail, all 6 security tests still fail),
  `ff-overbroad` (functional_fail, 7 functional tests fail),
  `ff-metadata` (functional_fail, 1 functional test fails),
  `pass-hardening` and `pass-alternative` (reward 1.0).
- The blind pass patch is listed in the manifest and intentionally absent; a later stage writes it.
  FAIRNESS.md is written after the trial, not here.

## End

- End UTC: 2026-10-30T05:55:20Z.

