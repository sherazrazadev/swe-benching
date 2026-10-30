# Findings to fix (winter-s4) — owner-requested blind check, 2026-10-29

Treat this like a "Required" change from the fairness review.

## Functional test FunctionalModelReadsTest::testStoredValuesStillReadAndCount enforces an unstated design — instruction fault
The test renders `{{ model.newQuery().count() }}` and requires output `1`. All 6 model runs and a blind Claude Opus fix failed it, each by denying the query-object accessor `newQuery` (DeepSeek r3 and MiMo r2 failed ONLY this test; every security test passed). The repo's own policy already blocks `getQuery` on models under "Prevent model data modification", so blocking `newQuery` is the natural maintainer choice. instruction.md's keep-list says only "settings and stored values still bind … lists and paged results supplied by the application still display, iterate and count"; a model's query object is neither, and "Everything that works today keeps working exactly as today" cannot be read literally (writeConfig also works today). Because score.py gates the reward on all functional tests, this one unstated constraint turns otherwise-correct fixes into 0.0.

Required: state the constraint in instruction.md's Contracts keep-list, e.g. change "settings and stored values still bind" to "settings and stored values still bind, and stored records can still be read and counted, including when a template reads or counts them through the model it was given". Keep the test. Re-gate; oracle and pass_alt must still reach 1.0.

## Keep the behaviour keep-list (do not shorten it)
A previous repair attempt replaced the Contracts keep-list with one generic line. That is not allowed: the generic "everything keeps working" line is exactly what made this task unfair. Keep every existing behaviour item in the keep-list word for word — settings and stored values still bind; loops, conditions, partials and the built-in filters still render; lists and paged results supplied by the application still display, iterate and count; callbacks written in the template still work on the values the application supplies — and ADD the stored-records item to it. Behaviour descriptions like these are not location hints and must stay. Only remove text that names a file, class, method, path or test.

## Instruction tone (owner rule, applies to every change above)
Write instruction.md as an issue report from the project: "In this codebase, <the exact bug and its impact>. Please fix it." State the bug, what must stop happening and what must keep working, plainly and completely, so a careful maintainer knows exactly WHAT to fix.
Never say WHERE: no file names, paths, directories, modules, class/function/method/variable names, line numbers, test names, lists of routes or variants, or counts. Describe behaviour only. Any new sentence must follow this rule; if an existing sentence breaks it, rewrite it to behaviour.
