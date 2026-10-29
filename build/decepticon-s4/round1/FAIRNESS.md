# FAIRNESS — decepticon-s4

P = *"No content that enters the product through a tool result — or any value derived from such content, however far downstream — may reach any message the model reads with a chat-template control literal still intact."* C1 visible chars survive in order; C2 non-literal text byte-exact; C3 operator-review bytes exact; C4 current structures/behaviour kept; C5 all accepted result forms; C6 example is not the full set / close variants.

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Fair because | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| security/test_envelope_special_tokens.py::test_web_fetch_output_cannot_carry_a_control_literal [17] | No listed literal survives the envelope | P; C6 | no for the primary composition fix; maybe only a fix omitting fullwidth-bar close variants | low–med |
| ::test_bash_output_cannot_carry_a_control_literal [3] | Same via bash | P | no | low |
| ::test_control_literal_is_defanged_even_without_a_risk_signal | `<|endoftext|>` gone at low risk | P (unconditional) | no; a detection-gated fix is wrong | low |
| ::test_control_literal_reassembled_from_content_blocks_is_defanged | Split literal gone after flatten | P; C5 | no; per-block defang is wrong | low |
| ::test_literal_in_a_list_of_plain_strings_is_defanged | `list[str]` form | P; C5 | no | low |
| ::test_every_occurrence_of_a_repeated_literal_is_defanged | Both repeats gone | P ("every such literal") | no; first-only is wrong | low |
| security/test_shield_body_special_tokens.py::test_external_tool_output_cannot_carry_a_control_literal [17] | No literal in shield wrap body | P; C6 | no; fullwidth caveat above | low–med |
| ::test_unknown_external_tool_output_cannot_carry_a_control_literal [4] | Unregistered tool | P (any message) | no | low |
| ::test_literal_in_content_blocks_is_defanged | Block form | P; C5 | no | low |
| ::test_literal_without_a_detection_signal_is_still_defanged | No detector hit | P | no | low |
| ::test_every_occurrence_of_a_repeated_literal_is_defanged | Both repeats | P | no | low |
| security/test_shield_banner_echo.py::test_banner_does_not_quote_a_control_literal_verbatim [5] | Banner carries no literal | P (banner is model-visible) | no; body-only is incomplete | low |
| security/test_notification_special_tokens.py::test_completion_output_cannot_carry_a_control_literal [7] | Reminder at model boundary | P; helper accepts composition or boundary | maybe only a boundary fix in a middleware the helper does not assemble | low |
| ::test_ansi_wrapped_literal_is_defanged | ANSI-wrapped literal | P; C4 | no | low |
| ::test_two_completed_sessions_cannot_each_carry_a_literal | Two sessions | P | no | low |
| ::test_async_completion_output_cannot_carry_a_control_literal | Async sibling | P; C4 | no | low |
| security/test_kg_summary_special_tokens.py::test_summary_label_cannot_carry_a_control_literal [5] | Summary at boundary | P; producer or boundary | maybe same helper caveat | low |
| ::test_summary_literal_is_defanged_without_an_existing_system_message | No prior system message | P | no | low |
| ::test_entrypoint_label_cannot_carry_a_control_literal | Entrypoint label | P | no | low |
| security/test_command_tool_output.py::test_command_report_cannot_carry_a_control_literal [9] | Command-carried message at boundary | P (tool result via state update) | maybe only a direct-ToolMessage-only fix (wrong) | low |
| ::test_command_report_is_defanged_in_either_wrapper_order | Both hook orders | P; C4 | no | low |
| security/test_quarantine_digest.py::test_ledger_digest_cannot_replay_a_recorded_literal | Stored excerpt not replayed | P ("derived … far downstream") | no; producer defang or un-trusting both pass | low |
| ::test_digest_defangs_every_recorded_literal [5] | Five families | P | no | low |
| ::test_ledger_digest_literal_is_defanged_even_when_the_tool_is_wrapped | Shield-wrapped path | P | no | low |
| functional/test_envelope_preservation.py (all 7) | Envelope shape, benign bytes, visible chars, families, blocks, ledger bytes | C1–C4 | no with U+200B; maybe a joiner outside `visible()` | low–med |
| functional/test_shield_preservation.py (all 7) | Wrap/trust/banner/marker behaviour | C1–C4 | no; defanging before detection fails banner category (wrong) | low |
| functional/test_notification_preservation.py (all 5) | Structure, readable capture, ANSI, once-only, truncation | C1, C4 | maybe joiner alphabet | low–med |
| functional/test_kg_preservation.py (all 4) | Header/counts/revision, readable labels, block order | C1, C4 | maybe joiner alphabet | low–med |
| functional/test_command_preservation.py (all 3) | State keys, readable digest, empty cache | C1, C4 | maybe joiner; block structure unchecked | low–med |
| functional/test_digest_preservation.py (all 4) | Readable digest, ledger untouched, limit, missing file | C1, C3, C4 | maybe joiner alphabet | low–med |
| functional/project/* (8 files, repo-visible suite) | Repo's own detector/envelope/shield/notify/KG/tool pins | C4; standard expert knowledge (suite is visible) | no | low |

## 2. Leniency (quality, non-blocking)

| Trap/property | Most plausible wrong fix | Caught by |
|---|---|---|
| general property | Fix only the reported site/example | envelope+shield [all forms], `sf-published-only.patch` |
| T1 envelope body | Detection-gated defang; first occurrence only | `test_control_literal_is_defanged_even_without_a_risk_signal`, repeated test, `sf-no-envelope.patch` |
| T2 shield body | Dismiss the second wrapper as a legacy duplicate | shield-body tests, `sf-no-shield-body.patch` |
| T3 banner echo | Trust the banner as own diagnostic metadata | banner [5], `sf-no-banner.patch` |
| T4 completion reminder | Treat it as status text; rely on enveloped bash_output | notification tests, `sf-no-notifications.patch` |
| T5 KG summary | Treat structured memory / system prompt as trusted | kg tests, `sf-no-kg.patch` |
| T6 Command message | Dismiss Command updates as framework plumbing; early-return non-ToolMessage | command tests, `sf-no-command.patch` |
| T7 ledger digest | Trust the product's own audit bookkeeping | digest tests, `sf-no-digest.patch` |
| one role/direction | Sync only | `test_async_completion_output...` |
| over-broad drop/escape | Delete or HTML-escape the literal | visible/benign functional tests, `ff-drop-token.patch`, `ff-escape.patch` |
| detect-first | Defang before detection (loses `chat_template_injection`) | `functional/test_shield_preservation.py::test_banner_still_names_the_detected_category` |

Wrong fixes no test catches: first-occurrence-only defang outside T1/T2 (T3–T7 payloads do not repeat one literal in a single message); flattening a Command ToolMessage's content blocks to text / dropping non-text blocks (command tests compare text only); defanging only `Command.update["messages"]` while other model-visible update keys stay raw; a central `wrap_model_call`-only sanitizer (fails T1/T2/T3/T7 — see below).

## 3. Hints (quality, non-blocking)

None. No file, function, mechanism, fix approach, trap, variant list or flaw count is named; `<|im_start|>` is the CVE's required example.

## 3a. Required: generalize

- *"…calls tools — shell commands, file reads, HTTP requests, page retrievals, scanners — and feeds every result back…"* The operation list maps onto several traps. → *"An engagement runs a LangGraph agent that feeds every tool result back into its own conversation."*

## 4. Realism (quality, non-blocking)

T1–T5 are real unmodified upstream and still open; T6/T7 are injected but plausible maintainer code reachable through the real hooks. Only mild contrivance: T7 joins the trusted set in the same patch. Nothing planted; no route is beyond the advisory.

## Verdict

**READY.** Each security test applies P read literally; the primary composition-site fix passes all, and `pass-alt` (U+2060, different site), `pass-hardening` and `blind` reach 1.0, so no oracle-specific site/character is required. Functional tests assert C1–C4 or the repo's visible suite. A `wrap_model_call`-only sanitizer and a joiner outside `visible()` are alternative implementations, not the stated composition mechanism, so gate a does not fire.

**Required: generalize** — the tool-kind list above.

**Quality to tighten** — (1) widen `visible()` to all format/joiner codepoints (U+2061–2064, U+034F, U+180E); (2) add repeated-literal payloads to T3–T7; (3) assert Command block structure and non-text blocks; (4) mirror `model_boundary_text` in T1/T2/T3/T7; (5) test a Command list-of-blocks.

**Human review:** confirm fullwidth-bar lookalikes and an invisible joiner outside the six-character `visible()` allowlist are in scope, and that T1/T2/T3/T7 may reject a `wrap_model_call`-only fix.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
