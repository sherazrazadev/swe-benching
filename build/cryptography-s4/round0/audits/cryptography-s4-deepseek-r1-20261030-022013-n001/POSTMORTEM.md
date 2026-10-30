# Post-run audit: cryptography-s4__eQnqkNV

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6667.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The model fixed two of the three defects: the permitted-subtree containment bug (the reported route) and the wildcard hostname suffix-match bug. It kept the excluded-subtree semantics overlap-based, so all 8 functional tests pass along with 4 of the 6 security tests. Both failing security tests come from one defect it never touched. build_chain_inner skips name-constraint evaluation for self-issued CAs (lib.rs, reference fix.patch:88-94), and the comment presents this as the RFC 5280 self-issued exemption. That exemption really covers only the self-issued cert's own names; it does not let the CA's own NameConstraints go unenforced for the certs beneath it. The model read lib.rs in full (transcript.md:13) and listed every DNSConstraint/matches call site (transcript.md:33,47), but its root-cause analysis names only two defects (transcript.md:49-53, 256-260) and it never changed the self-issued guard. The instruction covers this route: 'when a CA in the path restricts the DNS names it may issue for ... No chain that breaks either rule may be accepted', plus 'Fix the underlying issue and its close variants'. A correct fix (the reference fix just removes the guard) passes both tests. The ambiguity is minor and limited to selfissued_exact_permitted_escape, an exact-name case: the contract 'Everything that validates today for exact DNS names ... keeps validating exactly as today' could be read literally as protecting it. Read with 'keep legitimate use working' and the title ('accepts names outside a CA's permitted scope'), it is not legitimate use. Even setting that test aside, selfissued_wildcard_permitted_escape (a wildcard under a constraining CA) is squarely within the stated property, so the reward would still be below 1.0. No harness problems: results.json is complete, there were no tool calls during the grading window, and exception_info is null. No contamination found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security::selfissued_wildcard_permitted_escape | fail | genuine-fail | True | True |
| security::selfissued_exact_permitted_escape | fail | genuine-fail | True | True |
| functional::wildcard_overlapping_excluded | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The transcript shows no access to hidden tests (the /tests or fixtures paths never appear) and no web or upstream lookup. The only network attempt was `rustup component add rustfmt` (transcript.md:88-89), which failed with a TLS error and has nothing to do with the fix. There is no netguard.log in the evidence. The model wrote its own tests.

**Evidence:**
- evidence/grading/results.json:6-7 — selfissued_exact_permitted_escape and selfissued_wildcard_permitted_escape fail; the other 4 security and 8 functional tests pass
- evidence/solution/fix.patch:88-97 — the reference fix removes the `if !cert_is_self_issued(...)` guard around NAME_CONSTRAINTS evaluation
- evidence/final-code/changes.patch — edits types.rs, lib.rs (evaluate_single_constraint/NameConstraintKind and tests), and policy/mod.rs, but not the self-issued guard in build_chain_inner
- evidence/transcript.md:13 — the model read lib.rs in full; transcript.md:49-53 lists only two defects
- evidence/transcript.md:220 — the model saw cert_is_self_issued in certificate.rs while looking at test ops, but did not follow up
- evidence/instruction.md:24-29 — 'when a CA in the path restricts the DNS names it may issue for ... No chain that breaks either rule may be accepted'
- evidence/instruction.md:34-36 — the exact-name preservation contract, a minor source of ambiguity for the selfissued_exact test
- evidence/build-notes.md:31-33 — T2 is the injected self-issued skip; notes that the reference fix scores 6/6 + 8/8
- evidence/tests/security/ht_sec.rs:111-135 — the self-issued tests use the public verify() entry point with a root plus leaf and no intermediate
- evidence/run.json:12-20 — tool_calls_during_grading is empty, agent_events_after_end is 0, exception_info is null
- evidence/tests/score.py:58-64 — reward = 4/6 security, since all functional tests pass, giving 0.6667

**Recommended action:** Accept the 0.6667 reward as a fair measure: the model missed the self-issued-CA route, which the instruction covers. Optionally tighten the instruction's exact-name preservation contract, e.g. 'exact DNS names that are within every CA's scope keep validating', to remove the minor ambiguity around selfissued_exact_permitted_escape. That change would not alter this trial's outcome.
