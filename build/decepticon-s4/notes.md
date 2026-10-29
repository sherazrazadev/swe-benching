# decepticon-s4 — build notes

- Start UTC: 2026-10-28T16:18:40Z
- End UTC: 2026-10-28T16:54:40Z

## Gate results (stage by stage, one at a time)

- `static` — **PASS** (conformance "conforming"; no instruction leaks; no hidden tests in the image).
- `nop` — **PASS**: security 0/82 pass (82 fail), functional 249/249 pass, reward 0.0.
- `oracle` — **PASS** (strict, 3 runs): each reward 1.0, 331/331 tests, identical results.
- `patches` — **PASS** (12/12 as declared): 7 lever `security_fail` (23/28/9/10/7/7/7 security
  failures respectively, functional 249/249 each), `sf-published-only` (40 security failures),
  `ff-drop-token` and `ff-escape` (`functional_fail`, 7 functional failures each),
  `pass-hardening` and `pass-alt` (reward 1.0). `pass-blind.patch` and `FAIRNESS.md` are produced
  after this build, as instructed.
- Per-stage logs: `build/decepticon-s4/gate-{nop,oracle,patches}.log`; machine-readable:
  `build/decepticon-s4/gate_report.partial.json` (last stage) and the Harbor job dirs.

Advisory: GHSA-G5F9-3XFG-P9MF / CVE-2026-61732 (bittersecurity/decepticon). Pinned
`ba2e1343114adbab4d7fc0aab4c31c7ffb0c4171`; published fix `79ee2aaf22f4c36a5b1968f6ca3f8086b6e35b67`
(direct parent; no advisory regression tests between them). Track: injected. Pattern: A+B.

## Levers (one line each)

- **T1 envelope body** — A, landing, published: the quarantine envelope emits a control literal
  verbatim (`untrusted_output.py:149`). Reported path; everyone fixes it.
- **T2 shield wrap body** — A, far site / second implementation: a separate deny-list wrapper builds
  its own body for non-enveloped external tools (`prompt_injection_shield.py:209-215`). Reason to
  dismiss: looks like a legacy duplicate of the quarantine envelope.
- **T3 warning banner echo** — B, real unmodified upstream: the shield quotes the matched attacker
  sample in its banner *outside* the wrap body (`prompt_injection_shield.py:181-215`); the published
  fix neutralizes only the body. Reason to dismiss: the banner is the shield's own diagnostic
  metadata.
- **T4 completion reminder** — B, real unmodified upstream, different hook/role: captured terminal
  output is inlined into a user-role `<system-reminder>` at `before_model`
  (`notifications.py:86,250,272-278`). Reason to dismiss: a status reminder, and bash_output is
  already enveloped.
- **T5 structured-memory summary** — B, producer off the check's path: scanner-ingested node labels
  are rendered by `build_summary` into the system prompt (`kg.py:166-171`,
  `kg_internal/summary.py:143-157`). Reason to dismiss: the agent's own memory; system prompt feels
  like a neighbouring layer.
- **T6 Command-carried message** — injected sibling, return-type bypass: a tool reports through
  `Command(update={"messages": [...]})`; both wrappers early-return non-ToolMessage results
  (`untrusted_output.py:228`, `prompt_injection_shield.py:405`). Reason to dismiss: a Command update
  is framework state plumbing, not a tool result.
- **T7 quarantine-ledger digest** — injected sibling, stored-data round trip: the ledger stores raw
  high-risk excerpts by design; an injected review tool reads them back and is registered as a
  trusted internal tool (`tools/evidence/quarantine.py`). Reason to dismiss: it renders the
  product's own audit ledger.

Coupled must-keep-working values (functional): every visible character of the original text
survives (invisible joiners removed); benign HTML/Markdown/bracket text passes byte-for-byte; the
operator audit ledger keeps the exact original bytes; envelope provenance, banner categories,
reminder command/exit/session text, summary sections/counts, Command state keys and digest text all
keep working.

## Candidate list (every sibling site/route found) and why each pick won

Real, unmodified upstream:

1. Shield banner echo — **picked (T3)**: attacker bytes reproduced in a second composition outside
   the neutralized argument; how-type (needs the composition understood), still unneutralized on
   upstream main.
2. Sandbox completion reminder — **picked (T4)**: different hook (`before_model`) and message role;
   real captured bytes; still unneutralized on main.
3. KG summary system prompt — **picked (T5)**: data produced by a separate ingest/render pipeline
   that the check never calls; how-type; still unneutralized on main.
4. `task` sub-agent report bypass — **rejected**: proving it layer-agnostically needs an end-to-end
   subagent dispatch (LLM/network), and a fix at the `task` tool would not be exercised by a
   shield-hook test; the "trusted by design" label also makes a solver's dismissal reasonable.
5. `opscontrol_notifications` reminder — **rejected**: fields come from the operator-controlled
   daemon (workload/state/since), not target bytes.
6. `references/tools.py` `_sanitize_corpus_text` / `_wrap_corpus` — **rejected**: those tools are
   neither framework-trusted nor in the enveloped set, so the shield wraps them and the published
   fix already covers the output; no gap remains.
7. `recording.py` ReplayMiddleware — **rejected**: `cart.py` appends it after the standard slots, so
   the quarantine wrappers stay outside it and still see the recorded ToolMessage; not shown wired
   outermost.
8. `hitl.py` tool results — **rejected**: operator-authored choices, not target bytes.
9. `roe.py` refusal results — **rejected**: product-authored refusal text.
10. `subagent_streaming.py` error AIMessages — **rejected**: product-authored error strings.
11. `tools/opplan.py` Command messages — **rejected as a route**: plan fields are agent-authored;
    used only as the pattern for the injected Command sibling.
12. filesystem write confirmations — **rejected**: confirmation text is product-authored.
13. engagement/opplan/skillogy system-block injections — **rejected**: operator/agent/repo-authored.
14. O8b second notification formatter for another job class — **rejected**: same sink/concept as T4.
15. O8b planned summary section-5 renderer — **folded into T5**: the existing `_render_vulns` already
    interpolates scanner-derived labels, so no injection was needed.

Injected siblings (picked 2 of 2 considered):

16. **Command-returning tool (T6)** — picked: how-type return-type bypass in real code, far from the
    report, plausible ("framework plumbing"), fully offline and layer-agnostic to test.
17. **Quarantine-ledger digest tool (T7)** — picked: producer/consumer round trip through stored
    attacker bytes, couples the audit-ledger preservation clause, plausible ("our own audit tool").

## Injected code (environment/injection.patch)

- `packages/decepticon/decepticon/tools/web/crawl_archive.py` — `crawl_archive_digest` reads cached
  pages and reports a digest through a `Command` update; wired into `WEB_TOOLS`, the web package
  exports and the recon agent.
- `packages/decepticon/decepticon/tools/evidence/quarantine.py` — `quarantine_digest` renders
  quarantine-ledger events; wired into the evidence exports and the analyst agent, and registered in
  the shield's framework-trusted set ("our own audit ledger").
- Neither file is touched by the published fix. `_injection_detector`, both wrappers, the reminder
  formatter and the KG prompt block are the oracle's edit sites.

## Pre-trial fairness revision (2026-10-29)

Applied the FAIRNESS review's "Required: generalize" items and the independent-audit findings:

- `instruction.md`: generalized the content-form sentence ("any of the forms the product
  accepts") and the derived-value clause ("or any value derived from such content, however far
  downstream"); removed the two hint sentences (invisible-insert technique, benign-bracket
  vocabulary) in favour of the neutral visible-character and byte-for-byte properties. No route,
  file, function, variant list or flaw count added.
- `tests/support/helpers.py`: added `model_boundary_text`, which assembles the submission's
  middleware stack with `build_middleware` and drives the synchronous model-call chain to the
  final handler, so a literal made inert at the model boundary is observed as the model reads it.
- `security/test_notification_special_tokens.py`, `security/test_kg_summary_special_tokens.py`,
  `security/test_command_tool_output.py`: assert on the model-boundary text (falling back to the
  composition-site text if the stack cannot be assembled). A producer-side fix and a
  model-boundary fix both pass, resolving the three audit test-fault findings. The T6 setup
  assertion that the raw `Command` must still carry the literal was dropped, so a guard inside
  the reporting tool is not penalised.
- Added repeated-literal payloads (envelope and shield) so a first-occurrence-only defang is
  caught.

Not changed: the mixed ASCII/fullwidth-bar forms stay in scope. The audits call them a genuine
(if borderline) model shortfall, and naming delimiter-width mixing in the instruction would be a
variant-list hint; the general "close variants" clause covers them.

Command-message block-structure assertion (FAIRNESS "Quality to tighten"): not applied. The
reference `_neutralize_command_messages` rewrites `ToolMessage.content` to text, so asserting
block structure would require changing the oracle and regenerating every check patch; it is a
leniency item, not a fairness defect.

Gate results after the revision (stages run one at a time): `static` PASS; `nop` PASS
(security 84/84 fail, functional 249/249 pass, reward 0.0); `oracle` PASS 3/3 (333/333,
reward 1.0, identical); `patches` PASS 13/13 (7 lever `security_fail`, `sf-published-only`
`security_fail`, `ff-drop-token`/`ff-escape` `functional_fail`, `pass-hardening`/`pass-alt`/
`blind` reward 1.0; `pass-blind.patch` remains absent and is filtered as before).

## Second pre-trial revision (2026-10-29, audit-driven)

Applied the remaining FAIRNESS "Required: generalize" item and the independent-audit
instruction-ambiguity finding (AUDIT-FINDINGS.md), plus the cheap/safe quality items:

- `instruction.md`: removed the tool-kind enumeration ("shell commands, file reads, HTTP
  requests, page retrievals, scanners") in favour of the general sentence "an engagement runs
  a LangGraph agent that feeds every tool result back into its own conversation".
- `instruction.md`: widened the one general property over the protected data — a control
  literal now also includes "any look-alike in which the delimiting characters are written
  with visually similar substitutes". This is audit recommended option (a): it puts the
  mixed/fullwidth-bar forms in scope without enumerating a variant list, naming a route, or
  naming a file/function/mechanism.
- `tests/support/helpers.py`: `visible()` now also ignores U+2061–U+2064, U+034F and U+180E
  (FAIRNESS quality item 1), so a neutralizer using any invisible format character is not
  penalised by the functional preservation tests.
- Security tests T3–T7: each payload now repeats its literal inside the same message
  (FAIRNESS quality item 2), so a first-occurrence-only defang is caught at the banner,
  completion-reminder, KG-summary, Command and ledger sinks as well as at T1/T2.

Not applied (quality items, not fairness defects; see FAIRNESS "Quality to tighten"):
Command block-structure / non-text-block assertions and a Command list-of-blocks test
(would require rewriting the oracle's Command rewrite and regenerating every check patch,
and the injected tool reports text), and mirroring `model_boundary_text` into T1/T2/T3/T7
(those tests drive the tool-call composition hook; the boundary helper only assembles
model-call hooks, so it cannot observe a boundary-only fix there). The reference oracle
already defangs every occurrence and both bar widths, so no oracle change was needed.

Gate results after this revision, one stage at a time: `static` PASS; `nop` PASS
(security all fail, functional all pass); `oracle` PASS 3/3 (reward 1.0, identical runs); `patches`
PASS 13/13.

## Verified

- Every route reproduces at pinned+injection through the real hooks (probe scripts under
  `~/.tb-graders/cwe/work/decepticon-s4/probe/`).
- Offline image (`python:3.13-slim`, deps from `uv.lock`, `--network none`): project tests for the
  affected area 914 passed; nop security 82 failed / functional 249 passed; oracle security 82
  passed / functional 249 passed.
- 12 check patches generated from the oracle and validated against the injected baseline:
  7 `security_fail` (one per lever), 1 published-only, 2 over-broad `functional_fail`, 1 hardening
  `pass`, 1 alternative `pass`. All behaved as declared (each `security_fail` leaves functional at
  249/249).
- The alternative pass uses U+2060 instead of U+200B and a different reminder composition point, so
  the tests do not require the oracle's exact invisible character or site.
- Upstream read-only check on `main` (`cc604456`): the shield banner, completion reminder and KG
  summary block still lack neutralization, so `present_in_latest = yes` for T3/T4/T5.

## Not verified / could not

- Full Docker/Harbor gate stages were not run before the end timestamp; see the gate report.
- The tokenizer-level proof from the advisory (transformers + Hub model) was not exercised; it needs
  network and is not required by the hidden tests.
- `repo_mb` is unknown (no size tool used on the worktree).
- The `task` sub-agent route was found but not built (see 4 above).
- The exact deployment wiring of `ReplayMiddleware` was not traced past `cart.py`.

## Out-of-scope note (one line, not built on)

`tools/references/tools.py` ships a second trust envelope/sanitiser for third-party corpus text with
no special-token arm; it is incidentally covered by the fixed shield and was not pursued.
