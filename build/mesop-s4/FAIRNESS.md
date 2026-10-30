# FAIRNESS — mesop-s4

Static review; nothing was run. Inputs: `instruction.md`, 10 security + 6 functional + 3 project tests,
`solution/fix.patch`, `environment/injection.patch`, `manifest.json`, `notes.md`, `checks/*.patch`.

## 1. Test-by-test fairness

| Test (file::name) | Asserts | Covering sentence (quoted fragments) | Correct fix could fail? | Risk |
|---|---|---|---|---|
| `security/test_report_values_terminal.py::test_escape_sequence_in_page_and_blocked_url` | no CSI/OSC/DCS/APC/PM/SOS/two-byte payload in stdout; status <500 | "every value a request carries", "no matter how that value reaches the output" | no — value-level or whole-report sanitizing both pass | low |
| `…::test_two_byte_escape_alone_in_page_path` | `\x1b7` absent | "terminal escape sequences … control" | no | low |
| `…::test_control_character_in_blocked_url` | CR/LF/BS/NUL/U+202E absent | "raw control characters … inserted line breaks, and bidirectional overrides" | no | low |
| `…::test_control_character_in_page_path` | same in `document-uri` | same | no | low |
| `security/test_report_log_records_terminal.py::test_report_summary_record` | one-line record carries no payload | "or to the server's log" | no | low |
| `…::test_violation_tracker_record` | tracker record carries no payload | same + "every value" | no | low |
| `…::test_rejected_document_warning` | 4xx **and** no payload in the warning | "client error (a 4xx response)" + "every diagnostic" | no | low |
| `security/test_asset_location_terminal.py::test_escape_sequence_in_asset_location` | 4xx; no payload in logs | "every value a request carries" + "must not be left to surface as an unhandled server error" | no — handler 400, pre-routing guard, 403/404 all pass; a sanitized 500 does not, and the refusal clause forbids it | low |
| `…::test_escape_sequence_in_rejected_file_extension` | 4xx; no payload | same | no | low |
| `…::test_control_character_in_asset_location` | 4xx; no control payload | same | no | low |
| `functional/test_csp_diagnostic.py::test_accepted_report_still_prints_the_diagnostic` | 204; banner wording, directive, URL, path, origin | "still prints the same diagnostic, with its existing wording" | no | low |
| `…::test_diagnostic_keeps_its_colour_and_layout` | product ANSI colours, ⚠, ━, ≥10 newlines, no literal `\n` | "existing … symbols, colour and multi-line layout" | no — only whole-banner sanitizing fails, which this forbids | low |
| `…::test_suggested_policy_shows_the_plain_origin` | 204; plain origin for three directives | "the policy snippet … blocked origin" | no | low |
| `…::test_warning_keeps_its_own_marker` | 4xx; `\x1b[93m[warning]\x1b[0m` present | "Everything that works today keeps working exactly as today" | no — sanitizing the value keeps the helper's marker; sanitizing the finished line is the `ff_overbroad` class | low |
| `…::test_non_ascii_page_values_are_preserved` | 204; `café` printed | "non-ASCII text … unchanged" | no | low |
| `…::test_valid_web_component_asset_is_still_served` | 200; gzip; body | "Keep every legitimate use working" | no | low |
| `functional/project/static_file_serving_test.py::test_send_file_compressed_do_not_cache` | `gzip_cache` empty | standard expert knowledge: leave the unrelated helper's contract alone | no | low |
| `…::test_send_file_compressed_uncached_request` | gzip body; cache populated | same | no | low |
| `…::test_send_file_compressed_cached_request` | cached bytes returned | same | no | low |

## 2. Leniency (non-blocking)

| Trap | Plausible wrong fix | Caught? |
|---|---|---|
| T1 | SGR-only strip (`checks/sf_sgr_only.patch`) | yes — `test_escape_sequence…`, `test_two_byte_escape…` |
| T2 | ANSI-only (`checks/sf_no_control.patch`) | yes — `test_control_character_*` |
| T3 | keep the raise (`checks/sf_no_asset.patch`) | yes — 4xx assertions |
| T4/T5/T6 | reference minus each sink (`sf_no_s1/s2/warn.patch`) | yes — the three log-record tests |
| T7 | sanitize the whole banner (`ff_overbroad.patch`) | yes — colour/layout test |
| refuse-all | `ff_refuse_all.patch` | yes — functional group |

No test catches: **deleting** the T4 record or T5 tracker (both assert absence only; no test requires the record to still appear); stripping only C0/DEL (no C1 `U+009B`/`U+009D`, no `U+007F`); bidi isolates `U+2066–2069` and `U+200E/F` (only `U+202E` is driven); removing a single byte of a sequence (assertions are `payload not in output`, not "no escape byte survives"); non-string/missing `csp-report` fields (500, though the refusal clause demands 4xx); other report fields, which reach no sink.

## 3. Hints (non-blocking)

- "cursor and screen control, colour changes, hyperlink escapes, raw control characters …, inserted line breaks, and bidirectional overrides" — variant list. → "every terminal escape sequence and control character".
- "One trigger … `POST /__csp__`" — names the entry point. → "A browser sends a report whose body is …".
- "The example above is one instance, not the full set" — flaw/set hint. → delete.
- "including percent-encoded and non-ASCII text" — value-kind list. → "Ordinary values".
- "Fix the flaw and its close variants" → "Fix the flaw generally".

## 3a. Required: generalize

- "prints a human-readable diagnostic to the console where the developer is watching, suggesting how to update the policy" → "writes a message about it to the operator's output".
- "every diagnostic the application emits about it" → "every message it writes about it".
- "the policy snippet it suggests still shows the plain address of the blocked origin" → "every part of the message it prints today still appears unchanged".

## 4. Realism (non-blocking)

T1/T3 are real upstream code reachable through the real endpoints; T2 is a real gap (later upstream control stripping). T4/T5/T6 are plausible maintainer additions on `POST /__csp__`; mildly staged in that three siblings share one route and T5 exists only to split the sink. Low.

## Verdict

**READY (gate a).** The natural correct fix — sanitize every client-supplied string as it is written, plus make asset-route refusals client errors — passes all 19 tests. Central `_sanitize_report`, per-field sanitizing and a pre-routing guard are all green. The asset route is covered by the property read literally ("every value a request carries … no matter how"), and its 4xx demand by the refusal clause; a sanitized 500 or whole-output sanitizing is forbidden by the instruction, so failing them is leniency, not unfairness.

**Quality to tighten:** assert the T4/T5 records still appear; assert no residual ESC/C0/C1 byte; add C1, DEL, `U+200E/F`, `U+2066–2069`; add a non-string-field case; apply the rewordings.

**Human review:** Confirm the asset route's 4xx demand is fairly derivable from the refusal clause, and that preserving the warning's own colour on a *rejected* report falls within "everything works today".

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
