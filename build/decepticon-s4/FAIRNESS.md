# FAIRNESS — decepticon-s4

P = *"No content that enters the product through a tool result — or anything derived from such content … — may reach **any message the model reads** with a chat-template control literal still intact"* + *"Wherever such content is composed into a model-visible message … made inert before the model sees it."*
C1 visible characters survive (invisible inserts only, no remove/rewrite/escape/truncate/reorder); C2 non-literal bracket text byte-exact; C3 operator-review bytes exact; C4 today's behaviour, structures and readable content kept; C5 text or content blocks; C6 "one example, not the full set … close variants".

## 1. Test-by-test fairness

One row per test function; `[n]` = parametrised ids. `functional/project/*` are the repository's own visible tests, grouped per module.

| Test (file::name) | Asserts | Fair because | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| security/test_envelope_special_tokens.py::test_web_fetch_output_cannot_carry_a_control_literal [17] | No ChatML/Llama-3/Gemma/Mistral/Llama-2/fullwidth literal survives the envelope | P + C6 | no — any joiner, any T1 layer | low (fullwidth ids: med) |
| ::test_bash_output_cannot_carry_a_control_literal [3] | Same for bash | P | no | low |
| ::test_control_literal_is_defanged_even_without_a_risk_signal | `<|endoftext|>` defanged at risk=low | P (unconditional) | no; a detection-gated fix is wrong | low |
| ::test_control_literal_reassembled_from_content_blocks_is_defanged | Literal split over two blocks defanged after flattening | P + C5 | no; per-block defang is wrong | low |
| ::test_literal_in_a_list_of_plain_strings_is_defanged | Same for `list[str]` | P + C5 | no | low |
| security/test_shield_body_special_tokens.py::test_external_tool_output_cannot_carry_a_control_literal [17] | Same through the shield's own wrap (http_fetch) | P | no | low |
| ::test_unknown_external_tool_output_cannot_carry_a_control_literal [4] | Same for a tool in no registry | P ("any message") | no | low |
| ::test_literal_in_content_blocks_is_defanged | Block form | P + C5 | no | low |
| ::test_literal_without_a_detection_signal_is_still_defanged | `<|eot_id|>` with no detector hit | P (unconditional) | no | low |
| security/test_shield_banner_echo.py::test_banner_does_not_quote_a_control_literal_verbatim [5] | The quoting banner carries no literal | P (banner is part of the message read) | no | low |
| security/test_notification_special_tokens.py::test_completion_output_cannot_carry_a_control_literal [7] | Captured output in the user-role reminder defanged | P ("anything derived"), role-agnostic | no — any composer on the `before_model` path | low |
| ::test_ansi_wrapped_literal_is_defanged | Literal inside ANSI escapes | P + C4 | no | low |
| ::test_two_completed_sessions_cannot_each_carry_a_literal | Two sessions, two families | P | no | low |
| ::test_async_completion_output_cannot_carry_a_control_literal | Async sibling | P + C4 | no | low |
| security/test_kg_summary_special_tokens.py::test_summary_label_cannot_carry_a_control_literal [5] | Scanner-derived label in the system prompt | P ("stores and later reads back") | no — producer or `_inject_kg_context` both pass | low |
| ::test_summary_literal_is_defanged_without_an_existing_system_message | No pre-existing system message | P | no | low |
| ::test_entrypoint_label_cannot_carry_a_control_literal | Entrypoint label | P | no | low |
| security/test_command_tool_output.py::test_command_report_cannot_carry_a_control_literal [6] | Command-carried ToolMessage defanged | P (that message *is* the tool result) | maybe — a guard inside `crawl_archive_digest` fails the setup assert (line 50); see verdict | med |
| ::test_command_report_is_defanged_in_either_wrapper_order | Both hook orders | P + C4 | no | low |
| security/test_quarantine_digest.py::test_ledger_digest_cannot_replay_a_recorded_literal | Stored excerpt not replayed | P ("reads back or reproduces") | no — producer defang *or* un-trusting the tool both pass | low |
| ::test_digest_defangs_every_recorded_literal [5] | Same, five families | P | no | low |
| ::test_ledger_digest_literal_is_defanged_even_when_the_tool_is_wrapped | Same when the shield wraps it | P | no (deliberately layer-agnostic) | low |
| functional/test_envelope_preservation.py (all 7) | Envelope shape/provenance kept; benign bytes; visible chars; ledger raw | C1–C4 | no | low |
| functional/test_shield_preservation.py::test_banner_still_names_the_detected_category | "chat_template_injection" still named | C4 | no if defanging stays at composition; only defanging *before* detection fails (a behaviour regression) | med |
| functional/test_shield_preservation.py (other 6) | Wrap kept, benign bytes, visible chars, trusted/enveloped skip, marker `​` | C1–C4 (marker pin is also in the repo's visible test) | no | low |
| functional/test_notification_preservation.py (all 5) | Structure, readable capture, ANSI stripped, once-only, truncation | C4, C1 | no | low |
| functional/test_kg_preservation.py (all 4) | Header/counts/revision, readable labels, static block, block order | C4, C1 | no | low |
| functional/test_command_preservation.py (all 3) | State update, readable digest, empty cache | C4, C1 | no | low |
| functional/test_digest_preservation.py (all 4) | Readable digest, ledger untouched, limit, missing file | C3, C1, C4 | no | low |
| functional/project/test_untrusted_output.py (TestDetector, TestEnvelopeWrapping, TestSystemPromptInjection, TestQuarantineLedger, TestSlotRegistration) | Repo detector/envelope/ledger/slot pins | C4 + standard expert knowledge (suite is in the repo) | no | low |
| functional/project/test_untrusted_output_envelope.py | `_format_envelope`/truncation/hash pins, incl. marker `​` | C4 (visible repo test) | no | low |
| functional/project/test_prompt_injection_shield.py | Detection, banner, wrap, trusted registry, tag smuggling | C4 | no | low |
| functional/project/test_injection_detector.py | Detector characterisation | C4 | no | low |
| functional/project/test_notifications.py | Reminder behaviour + error paths | C4 | no | low |
| functional/project/test_kg_summary_unit.py | Summary renderers | C4 | no | low |
| functional/project/test_kg_middleware_unit.py | KG hooks | C4 | no | low |
| functional/project/test_misc_tool_wrappers.py | Unrelated tool wrappers | C4 | no | low |

## 2. Leniency (quality, non-blocking)

| Trap | Most plausible wrong fix | Caught by |
|---|---|---|
| T1 envelope body | Defang only the story's literal / one family | envelope [17 forms], `sf-no-envelope` |
| T2 shield body | "Legacy duplicate of the envelope" — skip it | shield-body tests, `sf-no-shield-body` |
| T3 banner | "Our own diagnostic metadata" — body only | banner [5], `sf-no-banner` |
| T4 reminder | "Status text; bash_output is already enveloped" | notification [10], `sf-no-notifications` |
| T5 KG summary | "Our own structured memory" | kg [7], `sf-no-kg` |
| T6 Command | "Framework state plumbing" — early return | command [7], `sf-no-command` |
| T7 ledger digest | "Our own audit bookkeeping" — keep trusted | digest [7], `sf-no-digest` |
| unlisted route | Fix only the reported site | 40 tests, `sf-published-only` |
| one role | Sync/system only | `sf-no-notifications` |
| over-broad drop / escape | Delete or HTML-escape the literal | 7 functional tests, `ff-drop-token`, `ff-escape` |
| detect-first | Defang before detection | functional `test_banner_still_names_the_detected_category` |

Wrong fixes **no** test catches:
- First-occurrence-only defang (`replace(…, 1)`): no payload repeats one literal in a message.
- A Command path that flattens list content to `str`: only text is compared.
- Defanging only `Command.update["messages"]`; no other model-visible update key is exercised today.

## 3. Hints (quality, non-blocking)

- *"Making a literal inert **may insert invisible characters**, but it must not remove, rewrite, escape, truncate or reorder…"* — names the technique and the two `ff-*` traps. Neutral: *"What a human reads must not change: every visible character must survive, in order and unrepeated."*
- *"ordinary HTML tags, Markdown links, bracketed words, comparison operators"* — mirrors the hidden benign payload. Neutral: *"Text that is not a control literal must pass through byte-for-byte."*
- No file, function, route name, variant list or flaw count appears; C6 is already neutral.

## 3a. Required: generalize

- *"Tool results may arrive as plain text or **as a list of content blocks**; both forms are covered."* — one format, exists to cover the block tests. → *"Tool results may arrive in any of the forms the product accepts; every form is covered."*
- *"including content the product **stores and later reads back or reproduces**"* — a channel mapping onto T5/T7. → *"or any value derived from such content, however far downstream"*.

## 4. Realism (quality, non-blocking)

T1–T5 are real, unmodified upstream and still open on main: realistic by definition. T6/T7 are injected but plausible — a `Command`-returning digest tool is ordinary LangGraph, and a ledger-review tool trusted as "our own bookkeeping" is a natural maintainer error — and both are reachable through the real hooks the repo's own visible tests drive. Only mild contrivance: `quarantine_digest` joins `_FRAMEWORK_TOOL_NAMES` in the same patch that adds it.

## Verdict

**READY.** Every security test is covered by P read literally, and all are satisfiable at the natural composition site with any invisible joiner — `pass-alt` (U+2060, different reminder site) and `pass-hardening` both reach 1.0, so no oracle-specific site or character is required. Functional tests assert only C1–C4 or the repository's own visible suite. No contradiction, impossible spec or unfaithful harness was found.

Borderline, resolved rather than failing: T6's setup assert rules out a guard placed inside `crawl_archive_digest`. P's composition-site wording fixes the site at the wrapper, and the producer also writes operator-visible `crawl_archive.digest`, which C3 keeps byte-exact.

**Required: generalize** — (1) the content-block format sentence, (2) the "stores and later reads back" clause; wording above.

**Quality to tighten** — (1) add a repeated-literal payload to catch first-occurrence-only defang; (2) assert a Command message's block structure, not just text; (3) neutralise the two hint sentences; (4) move or drop the T6 setup assert so a producer-side guard is not penalised.

Human review: confirm the T6 producer-layer reading (setup assert vs. the composition-site mechanism) and that the six-character invisible-joiner alphabet `visible()` strips is intended to be derivable from the repo's own `​` convention.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
