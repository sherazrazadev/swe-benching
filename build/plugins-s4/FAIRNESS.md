# Fairness and leniency review — plugins-s4

Graded tests: 7 security (`tests/security/zz_sec_test.go`), 9 hidden functional
(`tests/functional/zz_func_test.go`), 5 project tests (`tests/pristine/watch_test.go`). score.py
requires all of them for reward 1.0.

Covering sentences used below:

- **S-Pro**: "For every per-container security setting that the shipped rule set reports, the setting must be seen for every container the request would run: a value carried by any container must be reported, wherever that container is declared."
- **S-Fire**: "A request that must be reported makes the shipped rule set fire."
- **S-Cat**: "The plugin's exported field catalogue must offer the same per-container values for every container list a request can carry, under its existing per-container naming with the container list's own key in place of the regular list's key. A value available for a regular container must be available for the same container in every list, and must return the values that container actually declares. A list that cannot carry a given value must not advertise it."
- **S-Keep**: "Values that are published today keep their exact meaning, scope, ordering and index alignment."
- **S-Exc**: "The existing trusted-image allowance remains the only exception."
- **S-Neg**: "A request that must not be reported … must not make a rule fire that the otherwise-identical request does not."
- **S-Whole**: "These requirements cover the whole shipped detection, not only the example above."
- **S-Legit**: "Keep legitimate use working."
- **S-Repo**: standard expert/repository knowledge — published per-container semantics (declaration order, index arg, space-joined command/args, repository stripping, absent securityContext skipped), the `containers`/`initContainers`/`ephemeralContainers` keys, the top-level payload of a `pods/ephemeralcontainers` request (already visible in the shipped EphemeralContainers Created rule), and Kubernetes' ban on ports for ephemeral containers.

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Fair because | Correct fix could fail? | Risk |
|---|---|---|---|---|
| `security/zz_sec_test.go::TestSecPrivilegedInitContainerReported` | A pod-create event with a privileged init container makes a shipped rule fire that its non-privileged twin does not. | S-Pro + S-Fire | No | low |
| `security/zz_sec_test.go::TestSecPrivilegedEphemeralContainerReported` | A `pods/ephemeralcontainers` update whose request object carries the list at top level makes a rule fire that the non-privileged twin does not. | S-Pro ("wherever … declared") + S-Fire + S-Whole; payload shape visible in shipped rule (S-Repo) | No | low |
| `security/zz_sec_test.go::TestSecRootUserInInitContainerReported` | `runAsUser: 0` on an init container makes a rule fire that the `1001` twin does not. | S-Pro ("every per-container security setting that the shipped rule set reports") + S-Whole | No | low |
| `security/zz_sec_test.go::TestSecPrivilegeEscalationInInitContainerReported` | `allowPrivilegeEscalation: true` on an init container makes a rule fire that the `false` twin does not. | S-Pro + S-Whole | No | low |
| `security/zz_sec_test.go::TestSecFieldCatalogueCoversEveryContainerList` | Every regular suffix is registered for `initContainers` (including `host_port`) and for `ephemeralContainers` (all but `host_port`), with the same IsList/index shape; ephemeral must not advertise `host_port`. | S-Cat, especially its last sentence; S-Repo (ports are not allowed on ephemeral containers; init containers use `Container`) | No — a fix advertising `host_port` for ephemeral contradicts S-Cat | low-medium |
| `security/zz_sec_test.go::TestSecInitContainerValuesExtracted` | Init fields return the declared values in declaration order, index selects one, command/args joined, repository stripped, caps per container, one `eff_*` value per init container. | S-Cat + S-Keep + S-Repo (all visible regular-list semantics) | No | low |
| `security/zz_sec_test.go::TestSecEphemeralContainerValuesExtracted` | Ephemeral values are extracted both from `spec.ephemeralContainers` and from the top-level attachment payload, with index arg. | S-Pro + S-Cat ("every container list a request can carry") + S-Repo | No | low |
| `functional/zz_func_test.go::TestFuncRegularPrivilegedPodStillReported` | Positive control: regular privileged pod with untrusted image still reported. | S-Fire + S-Legit | No | low |
| `functional/zz_func_test.go::TestFuncTrustedImageExceptionStillSuppresses` | Trusted regular image still suppresses even when an init list carries a different (untrusted) image; untrusted still reports. | S-Exc ("existing") + S-Neg | No for the primary fix (leave the shipped condition term intact); only a fix that redefines the allowance to require every list's image trusted fails, which changes the "existing" allowance | medium |
| `functional/zz_func_test.go::TestFuncRegularContainerValuesStayScoped` | `ka.req.pod.containers.*` remains regular-only and index-aligned with `image.repository`. | S-Keep ("scope", "index alignment") | No | low |
| `functional/zz_func_test.go::TestFuncDeprecatedSummariesUnchanged` | `ka.req.container.{privileged,image,image.repository}` still summarise the regular list only. | S-Keep ("the deprecated per-pod summaries keep summarising the same list") | No | low |
| `functional/zz_func_test.go::TestFuncAbsentSecurityContextIsSkipped` | Containers without a securityContext yield no per-container value and no error; deprecated summary is false. | S-Cat ("values that container actually declares") + S-Keep + S-Repo | No | low |
| `functional/zz_func_test.go::TestFuncIndexOrderingAndJoinsPreserved` | Declaration order, index arg and space-joined command/args for regular containers. | S-Keep ("ordering and index alignment") + S-Repo | No | low |
| `functional/zz_func_test.go::TestFuncRegularHostPortsAndNoEphemeralPorts` | Regular `host_port` works; ephemeral advertises none. | S-Keep + S-Cat last sentence + S-Repo | No | low-medium |
| `functional/zz_func_test.go::TestFuncNonPrivilegedPodAddsNoDetection` | A non-privileged pod raises no rule that the same pod with a privileged regular container does not. | S-Neg | No | low |
| `functional/zz_func_test.go::TestFuncAllowedPodsRaiseNoPrivilegedAlert` | Non-privileged and trusted-image privileged pods raise no rule whose description/output mentions "privileged". | S-Neg + S-Exc | No | low |
| `pristine/watch_test.go::TestOpenFileWatch_DetectsNewContent` | File watcher processes appended content. | S-Legit; unrelated to the fix | No (timing-sensitive, but passes on pinned tree) | low |
| `pristine/watch_test.go::TestOpenFileWatch_HandlesRotation` | Watcher handles log rotation. | S-Legit | No | low |
| `pristine/watch_test.go::TestOpenFileWatch_HandlesTruncation` | Watcher detects truncation. | S-Legit | No | low |
| `pristine/watch_test.go::TestOpenFileWatch_NoTrailingNewline` | Watcher does not overshoot an unterminated final line. | S-Legit | No | low |
| `pristine/watch_test.go::TestOpen_FileScheme` | `file://` open works. | S-Legit | No | low |

## 2. Leniency (quality, non-blocking)

| Property / trap | Most plausible wrong fix | Caught? |
|---|---|---|
| L1 ephemeral attachment route | Rely on the existing EphemeralContainers Created rule; extract only `spec.ephemeralContainers`; add an attachment rule with no privileged condition | Yes — `TestSecPrivilegedEphemeralContainerReported`, `TestSecEphemeralContainerValuesExtracted` (`miss_subresource.patch`) |
| L2 scope / allowance | Union all lists into `ka.req.pod.containers.*` or rewrite the deprecated summaries; make the privileged rule always fire | Yes — `TestFuncRegularContainerValuesStayScoped`, `TestFuncDeprecatedSummariesUnchanged`, `TestFuncTrustedImageExceptionStillSuppresses` (`wrong_union.patch`); `TestFuncNonPrivilegedPodAddsNoDetection`, `TestFuncAllowedPodsRaiseNoPrivilegedAlert` (`wrong_refuse_all.patch`) |
| L3 root rule | Leave `Create Pod Running As Root` reading only `containers.run_as_user` | Yes — `TestSecRootUserInInitContainerReported` (`miss_root_rule.patch`) |
| L4 escalation rule | Leave `Create Pod With Privilege Escalation` reading only `containers.allow_privilege_escalation` | Yes — `TestSecPrivilegeEscalationInInitContainerReported` (`miss_esc_rule.patch`) |
| L5 catalogue / extractor | Register list fields but wire them to `spec.containers`; fix rules with `jevt.value` only | Yes — `TestSecFieldCatalogueCoversEveryContainerList`, `TestSecInitContainerValuesExtracted` (`miss_init.patch`) |
| Privileged setting (P1) | Fix init but not ephemeral, or only the privileged rule | Yes — the two privileged tests above |
| Root / escalation settings | Fix only the reported privileged rule | Yes — L3/L4 tests |

Wrong fixes **no test catches**:

1. **Allowance widened to every list**: a fix whose exemption applies when *any* list's image is trusted lets a trusted init/ephemeral image suppress a privileged untrusted regular container. `TestFuncTrustedImageExceptionStillSuppresses` only pairs a trusted regular image with an untrusted init image (the opposite direction).
2. **Attachment notice narrowed**: replacing the existing EphemeralContainers Created condition with a privileged-only one, or matching only `update` (not `patch`), is not caught; no test requires a benign attachment to keep firing, and only `update` is driven.
3. **Effective ids untested by value**: `TestSecInitContainerValuesExtracted` checks only that `eff_run_as_user`/`eff_run_as_group` return 2 entries. A fix returning `"0"` or a sibling container's id instead of the pod fallback passes; no fixture has a pod-level `runAsUser`/`runAsGroup`.
4. **Ephemeral not in the deprecated-summary fixture**: `TestFuncDeprecatedSummariesUnchanged` uses only an init container, so a fix that unions only `ephemeralContainers` into `ka.req.container.*` is not caught (`TestFuncRegularContainerValuesStayScoped` does cover `ka.req.pod.containers.*`).
5. **Ephemeral attachment trusted images**: no case checks whether the new attachment detection honours or ignores the trusted-image allowance for ephemeral images.

## 3. Hints (quality, non-blocking)

- "Privileged containers go unreported when they sit outside a pod's main container list." and "the shipped detection currently looks only at the main container list." — names the mechanism/flaw location. Neutral: "A per-container security setting can go unreported when the detection does not inspect the container that carries it."
- "A user can create a Pod whose privileged container is an init container rather than a regular one." — names one variant of the container-list set. Neutral: "A per-container security setting can be carried by a container the detection does not inspect."
- "The existing trusted-image allowance remains the only exception." — names the allowance mechanism (L2). Keep the contract but neutral: "Existing exemptions keep their current effect."
- "A value described as applying to regular containers keeps applying only to them, and the deprecated per-pod summaries keep summarising the same list they summarise today." — paraphrases the L2 trap. Neutral: "Existing published values keep their documented meaning and alignment."

## 3a. Required: generalize

none. No sentence describes the ephemeral attachment route, the subresource, or the injected root/escalation rules; the property is stated once over the protected outcome.

## 4. Realism (quality, non-blocking)

L1 (top-level `ephemeralContainers` payload) and L2/L5 are real, unmodified upstream code reachable through the real entry points; the top-level shape is already visible in the shipped EphemeralContainers Created rule. L3/L4 are injected CIS-benchmark copies of the existing privileged rule's condition — a plausible maintainer pattern, reachable on pod create. Nothing looks planted. Note: `build/plugins-s4/notes.md` still describes L3 as a capabilities rule and lists a "Create Pod With Added Capabilities" trap; the injected rule and tests actually use run-as-root. Build-note hygiene only. The init-container `ports` fixture is API-legal (`[]Container`); `spec.ephemeralContainers` is not a normal create payload but is used only to test extraction, while the route test uses the real top-level shape.

## Verdict

Gate A: READY. A natural correct fix (parameterise extraction by list, register init/ephemeral fields with `host_port` only for init, add init/ephemeral terms to every reporting rule, add a privileged-ephemeral attachment rule reading the top-level payload, leave regular-scoped values and the shipped trusted-image term intact) passes every graded test; the independent `pass_alt` design also passes. All assertions are covered by S-Pro/S-Fire/S-Cat/S-Keep/S-Exc/S-Neg/S-Whole plus visible repository behaviour and standard Kubernetes knowledge. No contradiction, no synthetic harness that a correct fix cannot satisfy.

Quality to tighten: (1) add a trusted-image-in-a-non-regular-list case; (2) assert the existing attachment notice still fires for a benign attachment and drive `patch`; (3) assert effective uid/gid values with a pod-level securityContext; (4) add an ephemeral case to the deprecated-summary test; (5) extend `zzEval` to honour `exceptions:`/`override:` or state the condition-term idiom; (6) align `notes.md` L3 with the injected run-as-root rule.

Human review: confirm the two borderline readings — that the catalogue's "a list that cannot carry a given value" clause makes `host_port` required for init but forbidden for ephemeral containers, and that the "existing" trusted-image allowance must stay scoped to regular-container images — plus the disclosed `exceptions:`/`override:` evaluator limitation.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
