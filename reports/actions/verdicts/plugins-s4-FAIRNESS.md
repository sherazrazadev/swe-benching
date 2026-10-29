# Fairness and leniency review — plugins-s4

Graded set: 7 security tests (`tests/security/zz_sec_test.go`), 10 hidden functional tests
(`tests/functional/zz_func_test.go`) and the 5 project watch tests (`tests/pristine/watch_test.go`,
restored by the verifier and counted in the functional group). `score.py` needs all of them for
reward 1.0. The pinned source tree is not in this checkout; the shipped rule file, `fields.go` and
`extract.go` were reviewed through `solution/fix.patch`, `checks/*.patch`, `manifest.json` and
`notes.md`.

Covering sentences (shorthand used in the table):

- **P** — "For every per-container security setting that the shipped rule set reports, the setting
  must be seen for every container the request would run: a value carried by any container must be
  reported, wherever that container is declared."
- **F** — "A request that must be reported makes the shipped rule set fire."
- **C** — "The plugin's exported field catalogue must offer the same per-container values for every
  container list a request can carry, under its existing per-container naming with the container
  list's own key in place of the regular list's key. A value available for a regular container must
  be available for the same container in every list, and must return the values that container
  actually declares. A list that cannot carry a given value must not advertise it."
- **K** — "Existing published values keep their documented meaning, scope, ordering and index
  alignment."
- **E** — "Existing exemptions keep their current effect."
- **N** — "A request that must not be reported … must not make a rule fire that the
  otherwise-identical request does not."
- **W** — "These requirements cover the whole shipped detection."
- **L** — "Keep legitimate use working."
- **SK** — standard expert/repository knowledge: the published regular-container semantics
  (declaration order, index argument, space-joined command/args, repository stripping, absent
  `securityContext` skipped) are visible in the tree; Kubernetes' `EphemeralContainer` rejects
  ports, while init containers are `Container` objects; a `pods/ephemeralcontainers` request object
  is a Pod carrying the list at `spec.ephemeralContainers`.

## 1. Test-by-test fairness

| Test (file::name) | What it asserts | Covering sentence | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| `security/zz_sec_test.go::TestSecPrivilegedInitContainerReported` | A pod-create event with a privileged init container makes a shipped rule fire that its non-privileged twin does not. | P + F + W | No — extending the privileged condition to the init list (or a new rule) passes; rule identity/layer is irrelevant. | low |
| `security/zz_sec_test.go::TestSecPrivilegedEphemeralContainerReported` | A `pods/ephemeralcontainers` **update** (Pod payload) and **patch** (`{"spec":…}`) with a privileged ephemeral container each add a fire the non-privileged twin does not. | P ("wherever that container is declared") + F + W + SK | No — a detection gated on `kcreate` fails, but that ignores "wherever declared"; the payload is the real Pod subresource shape. | low-medium |
| `security/zz_sec_test.go::TestSecRootUserInInitContainerReported` | `runAsUser: 0` on an init container makes a rule fire that the `1001` twin does not. | P ("every per-container security setting that the shipped rule set reports") + W | No — the injected root rule is visible in the tree and is the setting it reports. | low |
| `security/zz_sec_test.go::TestSecPrivilegeEscalationInInitContainerReported` | `allowPrivilegeEscalation: true` on an init container makes a rule fire that the `false` twin does not. | P + W | No — same reasoning. | low |
| `security/zz_sec_test.go::TestSecFieldCatalogueCoversEveryContainerList` | Every regular suffix is registered for `initContainers` (including `host_port`) and for `ephemeralContainers` (all but `host_port`), with the regular IsList/index/key shape; ephemeral must not advertise `host_port`. | C (all three clauses) + SK | No — omitting `initContainers.host_port` treats a `Container` list as port-less, contradicting C's "every list" clause; advertising it for ephemeral contradicts C's last clause. | low-medium |
| `security/zz_sec_test.go::TestSecInitContainerValuesExtracted` | Init fields return declared values in order, index selects one, command/args are space-joined, repository stripped, caps per container, `host_port`; `eff_*` returns one entry per init container and never a sibling's id. | C + K (ordering/index alignment) + SK (published regular semantics) | No — a fix that mirrors the published regular readers passes; returning raw arrays or dropping nil slots would not be "the same per-container values". | low-medium |
| `security/zz_sec_test.go::TestSecEphemeralContainerValuesExtracted` | Ephemeral values are read from `spec.ephemeralContainers` (pod object) and from the update/patch attachment payloads, including the index argument. | P + C + SK | No — reading the spec location (the real declaration) satisfies both forms; manifest records that a Pod-only fix scores 1.0. | low |
| `functional/zz_func_test.go::TestFuncRegularPrivilegedPodStillReported` | Positive control: a privileged regular container with an untrusted image is still reported. | F + L | No. | low |
| `functional/zz_func_test.go::TestFuncTrustedImageExceptionStillSuppresses` | A trusted regular image suppresses even when another list carries a different image; an untrusted regular container still reports; a trusted image in another list does **not** suppress it. | E + N + K | No — the natural fix leaves the existing condition term intact; widening the allowance changes its "existing effect". | low |
| `functional/zz_func_test.go::TestFuncRegularContainerValuesStayScoped` | `ka.req.pod.containers.*` remains regular-only and index-aligned with `image.repository`. | K ("scope", "index alignment") | No — unioning is a change of scope, not a correct fix. | low |
| `functional/zz_func_test.go::TestFuncDeprecatedSummariesUnchanged` | `ka.req.container.{privileged,image,image.repository}` keep summarising the regular list (init-only and ephemeral-only cases; regular-true control). | K | No. | low |
| `functional/zz_func_test.go::TestFuncBenignEphemeralAttachmentStillNoticed` | A benign update **and** patch attach of a non-privileged ephemeral container keeps raising a fired rule whose name/desc/output mentions "ephemeral". | L | No for the natural fix (add a new privileged rule; leave the shipped notice). Narrowing an existing notice is a behaviour change, not a correct fix. | low-medium |
| `functional/zz_func_test.go::TestFuncAbsentSecurityContextIsSkipped` | Containers with no/empty `securityContext` yield no per-container values and no error; the deprecated summary is false. | K + SK | No. | low |
| `functional/zz_func_test.go::TestFuncIndexOrderingAndJoinsPreserved` | Declaration order, index argument and space-joined command/args for regular containers. | K | No. | low |
| `functional/zz_func_test.go::TestFuncRegularHostPortsAndNoEphemeralPorts` | Regular `host_port` still extracts; ephemeral list advertises no port value. | K + C (last clause) + SK | No. | low |
| `functional/zz_func_test.go::TestFuncNonPrivilegedPodAddsNoDetection` | A non-privileged pod raises no rule that the same pod with a privileged regular container does not. | N | No — an always-firing rule is a wrong fix. | low |
| `functional/zz_func_test.go::TestFuncAllowedPodsRaiseNoPrivilegedAlert` | A non-privileged pod and a trusted-image privileged pod raise no fired rule whose description/output mentions "privileged". | N + E | No. | low |
| `pristine/watch_test.go::TestOpenFileWatch_DetectsNewContent` | The file watcher processes appended content. | L (pre-existing suite, untouched code) | No; timing-based (sleeps), so flake risk only. | low |
| `pristine/watch_test.go::TestOpenFileWatch_HandlesRotation` | Watcher handles log rotation. | L | No; timing-based. | low |
| `pristine/watch_test.go::TestOpenFileWatch_HandlesTruncation` | Watcher detects truncation. | L | No; timing-based. | low |
| `pristine/watch_test.go::TestOpenFileWatch_NoTrailingNewline` | Watcher does not overshoot an unterminated final line. | L | No; timing-based. | low |
| `pristine/watch_test.go::TestOpen_FileScheme` | `file://` open works. | L | No. | low |

## 2. Leniency (QUALITY, non-blocking)

| Property / trap | Most plausible WRONG fix | Caught? |
|---|---|---|
| L1 — ephemeral attachment route (never protected upstream) | Trust the shipped `EphemeralContainers Created` NOTICE; or read only the legacy top-level list; or add an attachment rule with no security term. | Yes — `TestSecPrivilegedEphemeralContainerReported` (update+patch) and `TestSecEphemeralContainerValuesExtracted`; `checks/miss_subresource.patch`. |
| L2 — coupled scope / allowance | Union init+ephemeral into `ka.req.pod.containers.*` or into `ka.req.container.*`; widen the trusted-image allowance to every list; always-fire privileged rule. | Yes — `TestFuncRegularContainerValuesStayScoped`, `TestFuncDeprecatedSummariesUnchanged`, `TestFuncTrustedImageExceptionStillSuppresses`, `TestFuncNonPrivilegedPodAddsNoDetection`, `TestFuncAllowedPodsRaiseNoPrivilegedAlert`; `checks/wrong_union.patch`, `checks/wrong_refuse_all.patch`. |
| L3 — injected root rule | Leave `Create Pod Running As Root` reading only `containers.run_as_user`. | Yes — `TestSecRootUserInInitContainerReported`; `checks/miss_root_rule.patch`. |
| L4 — injected escalation rule | Leave `Create Pod With Privilege Escalation` reading only `containers.allow_privilege_escalation`. | Yes — `TestSecPrivilegeEscalationInInitContainerReported`; `checks/miss_esc_rule.patch`. |
| L5 — catalogue + extractor far site | Register the new fields but wire them to `spec.containers`; or register fields and not update the rules. | Yes — `TestSecFieldCatalogueCoversEveryContainerList`, `TestSecInitContainerValuesExtracted`, all `TestSec*Reported`; `checks/miss_init.patch`. |
| P — privileged setting | Fix init only, or the create route only. | Yes — the two privileged tests. |
| P — other reported settings | Fix only the reported privileged rule. | Yes — L3/L4 tests. |
| C — catalogue | Wrong key case (`initcontainers`), omit `host_port` for init, advertise it for ephemeral. | Yes — catalogue + extraction tests. |
| K — published values | Union values / rewrite deprecated summaries. | Yes — stay-scoped and deprecated-summary tests. |
| E — exemption | Remove or widen the allowance. | Yes — `TestFuncTrustedImageExceptionStillSuppresses`. |
| N — negatives | Always-fire / over-broad rule. | Yes — the two negative controls. |
| L — shipped notice | Delete or narrow `EphemeralContainers Created`. | Yes — `TestFuncBenignEphemeralAttachmentStillNoticed` (update+patch). |

Wrong fixes **no test catches**:

1. **Non-privileged settings on an attachment.** No test drives an ephemeral attachment with
   `runAsUser: 0` or `allowPrivilegeEscalation: true`; the root and escalation rules stay
   `kcreate`-gated in the reference fix too, so a fix that only adds the privileged attachment
   rule scores 1.0 while missing two settings the stated property covers.
2. **Ephemeral on pod create.** No security test makes an ephemeral container the only privileged
   one on a create event; a fix that adds ephemeral terms only to the attachment rule passes.
   (Also: `spec.ephemeralContainers` on create may be API-illegal, which would make this moot.)
3. **Subresource gating of the attachment rule.** No fixture drives a different pod subresource
   carrying an ephemeral list, so dropping `ka.target.subresource in (ephemeralcontainers)` passes.
4. **Attachment + trusted image.** No case decides whether the new attachment detection honours or
   ignores the allowance for ephemeral images.
5. **Effective-id pod fallback.** The test accepts `"0"`; a fix that never consults the pod
   `securityContext` passes (deliberate, per `notes.md`; the shipped helper is itself buggy).
6. **Init containers without a `securityContext`.** Absent-context behaviour is only asserted for
   the regular list; the init path's nil handling is exercised indirectly through `eff_*`.

## 3. Hints (QUALITY, non-blocking)

- "A per-container security setting can go unreported when the detection does not inspect the
  container that carries it." — states the mechanism/fix approach. Neutral: "A per-container
  security setting can go unreported."
- "Fix the problem and its close variants." — announces a variant list. Neutral: "Fix the problem;
  do not special-case the reported case."
- "A Pod is admitted and no alert is raised, even though the Pod will run that container with the
  setting the rule set exists to report." — names the operation/object kind (Pod admission) and the
  rule-set stage. Neutral: "The request is admitted and no alert is raised, even though the
  container will run with the setting the detection exists to report."
- "A request that must be reported makes the shipped rule set fire." — "rule set" is the name of
  the rule stage; keep the observable, but "makes the shipped detection fire" is equivalent and
  less structural.

## 3a. Required: generalize

1. "The plugin's exported field catalogue must offer the same per-container values for every
   container list a request can carry, under its existing per-container naming with the container
   list's own key in place of the regular list's key."
   Names the entry point ("field catalogue") and prescribes the naming **format** by substitution.
   General rewording: "For every container a request declares, the product must publish the same
   per-container values it publishes for a pod's containers, under the same per-container name,
   returning that container's own value; it must not offer a value for a container that cannot
   carry it."
2. "The Kubernetes-audit plugin converts Kubernetes audit records into fields that Falco's shipped
   Kubernetes-audit rule set evaluates; the rule set is what raises an alert when a pod that is
   about to run a container with an unsafe setting is admitted."
   Enumerates the two stages a solver must touch (extraction and rule evaluation) — the L5 far
   site — in architecture terms. General rewording: "The shipped Kubernetes-audit detection must
   raise an alert when a request will run a container with an unsafe per-container setting."

Do **not** add a sentence naming the attachment route, the lists or the injected rules; widen the
property above instead.

## 4. Realism (QUALITY, non-blocking)

- L1 and L2/L5 are real, unmodified upstream code reachable through the public field catalogue,
  `ExtractFromJSON` and the shipped rule file; the legacy top-level ephemeral path is a real
  upstream quirk visible in the shipped attachment rule. Not contrived.
- L3/L4 are injected, but they are verbatim-style copies of the shipped privileged rule's
  one-list condition for other CIS settings, placed at natural points in the rule file and
  reachable on pod create. A maintainer could have written them; nothing looks planted.
- Fixtures: the init container's `ports` entry is API-legal (`[]Container`) but unusual; the
  `spec.ephemeralContainers`-on-create fixtures are extraction-only and may not be an API-legal
  create payload. Neither is a security route, so neither is contrived as a trap.
- Harness fidelity: the test-side evaluator deliberately ignores Falco `exceptions:` and `override:`
  blocks (`notes.md`). A fix that refactored the trusted-image allowance into an `exceptions:` block
  would keep its effect on real Falco but fail the functional suite. The natural fix edits the
  condition term, so this is a disclaimer, not a gate-a mechanism.

## Verdict

Gate a: **READY**. The primary-mechanism correct fix — parameterise per-container extraction by
list; register the same per-container fields for init and ephemeral (host_port only where the list
can carry it); add the list terms to **every** shipped rule that reports a per-container setting;
add an attachment detection reading `requestObject.spec.ephemeralContainers` for
`pods/ephemeralcontainers` update and patch; leave `ka.req.pod.containers.*`, the deprecated
summaries and the trusted-image term untouched — passes all 7 security, 10 functional and 5 project
tests. Detection assertions are differential (any rule, any layer, no error class or status
required); no test demands a rule name or a specific code site. The remaining borderline readings
(init `host_port`, the benign-attachment notice, the payload shape) resolve to wrong fixes or to
instruction-derived requirements, not to a correct-fix-fails mechanism. Leniency, hints and realism
do not change the gate.

**Quality to tighten** (specific changes):

- Add attachment-route cases for `runAsUser: 0` and `allowPrivilegeEscalation: true` — and extend
  the reference fix's root/escalation rules to `kmodify` + `ephemeralcontainers` — or scope the
  property to pod creation (wrong fixes #1).
- Add a create-event case where the only privileged container is ephemeral, if the API accepts it
  (wrong fix #2).
- Add a negative fixture for a non-`ephemeralcontainers` pod subresource carrying an ephemeral
  list (wrong fix #3).
- Add a trusted-image-in-the-ephemeral-list attachment case (wrong fix #4).
- Record in `notes.md` that the "0" effective-id fallback is accepted by design (wrong fix #5).
- Neutralize the four hint sentences in §3; apply the two rewordings in §3a.
- Support `exceptions:`/`override:` in `zzEval`, or state the condition-term idiom; lengthen the
  project watch tests' sleeps or poll instead (flake risk, not fairness).

Human review: confirm (1) that init containers may carry `ports` (so `initContainers.host_port` is
required) while ephemeral containers may not, (2) that `requestObject.spec.ephemeralContainers` is
the faithful update/patch payload while the shipped top-level path is legacy, and (3) that the
evaluator's lack of `exceptions:`/`override:` support cannot fail the natural condition-term fix.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
