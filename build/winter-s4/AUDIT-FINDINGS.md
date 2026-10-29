# Findings to fix (winter-s4) — owner-requested blind check, 2026-10-29

Treat this like a "Required" change from the fairness review.

## Functional test FunctionalModelReadsTest::testStoredValuesStillReadAndCount enforces an unstated design — instruction fault
The test renders `{{ model.newQuery().count() }}` and requires output `1`. All 6 model runs and a blind Claude Opus fix failed it, each by denying the query-object accessor `newQuery` (DeepSeek r3 and MiMo r2 failed ONLY this test; every security test passed). The repo's own policy already blocks `getQuery` on models under "Prevent model data modification", so blocking `newQuery` is the natural maintainer choice. instruction.md's keep-list says only "settings and stored values still bind … lists and paged results supplied by the application still display, iterate and count"; a model's query object is neither, and "Everything that works today keeps working exactly as today" cannot be read literally (writeConfig also works today). Because score.py gates the reward on all functional tests, this one unstated constraint turns otherwise-correct fixes into 0.0.

Required: state the constraint in instruction.md's Contracts keep-list, e.g. change "settings and stored values still bind" to "settings and stored values still bind, and stored records can still be read and counted, including through a model's query object". Keep the test. Re-gate; oracle and pass_alt must still reach 1.0.
