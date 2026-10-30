DECISION: KEEP
DATE: 2026-10-30

Decided under the owner's delegated rule (the instruction must state the exact bug and what must keep working; never where).
1. Rendering a template the application builds at runtime (Controller::getTwig() + createTemplate) is "whichever template is rendered" — the instruction's invariant applies to every render; yes.
2. "A refused render is ... an error raised while the template is processed" — for a template rendered directly (no page), an error raised during processing is the natural refusal; the error assertions accept any Throwable, no specific type or message. Fair.
3. The repaired instruction keeps the full keep-list (settings/stored values bind; stored records read and counted, including through the model given; loops, conditions, partials, built-in filters; lists and paged results display/iterate/count; template callbacks on supplied values). A blind Claude Opus fix (instruction + repo only) passed every functional test (run 40965701205), so the functional suite is covered by the stated contract.
Blind check: Opus 0.35, all 11 security misses inside the stated bug (callables, host constants/enums, template source, forwarded model method, page-file overwrite).
