
## Owner-requested fairness check (2026-10-30): instruction contradicts two security tests — instruction fault
All 6 model runs (DeepSeek and MiMo) scored 0.6667: every functional test passes and exactly `selfissued_exact_permitted_escape` and `selfissued_wildcard_permitted_escape` fail. Each test builds a self-signed root (`CN=Root`, CA, critical name constraint `Permitted: DNS:foo.example.com`) that directly issues the leaf (`evil.example.com`, resp. `*.example.com` requested as `bar.example.com`) and expects rejection. The tests match RFC 5280 (§4.2.1.10/§6.1.3(b) exempt only a self-issued certificate's OWN names from constraints set above it; a CA's constraints still bind certificates beneath it) and upstream behaviour — they are correct.
The instruction is the fault: (a) its contract says "Everything that validates today for exact DNS names … keeps validating exactly as today", yet `evil.example.com` validates today and the test requires it to stop; (b) the stated property is only about wildcards; (c) nothing says a self-issued CA's restrictions still bind. The models saw the self-issued exemption and kept it on purpose because the contract protected exact-name behaviour.
Required (behaviour only — no file, function, flag or test names):
1. Contract: change "Everything that validates today for exact DNS names…" to "Everything that validates today for exact DNS names that every CA in the path permits and does not exclude, and for wildcard names…" (keep the rest of the contract word for word).
2. Property: add "A CA's name restrictions bind every certificate issued beneath it, including when the CA's own certificate is self-issued, such as a self-signed root that carries name restrictions. Being self-issued only exempts a certificate's own names from restrictions imposed by CAs above it."
3. Observed impact: add the exact-name case, e.g. "…and a root that permits only one host name still accepts a certificate for a different host under the same domain."
Keep both tests. Re-gate; oracle and pass_alt must still reach 1.0.

## Owner rule (instruction tone)
instruction.md reads as an issue report: in this codebase, this is the exact bug and its impact, please fix it. Keep every sentence that states WHAT the bug is and WHAT must keep working, word for word. Remove only WHERE: file, path, module, class, function, method, variable, test names, line numbers.

## HARD RULE for this repair: only the three instruction edits above, nothing else
Make exactly the three changes listed (contract wording, the added self-issued property sentences, the added observed-impact clause). Every other line of instruction.md must stay byte-for-byte unchanged — in particular keep "- A wildcard still matches exactly one label when names are compared." (a previous attempt deleted it, which drops a stated must-keep-working behaviour), and keep the Constraints/closing lines as they are. Do not edit tests.
