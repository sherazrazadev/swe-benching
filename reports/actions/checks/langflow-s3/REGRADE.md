# langflow-s3: re-grade of the saved runs after the copy-test fix

Owner decision 2026-10-27: REPAIR. The instruction says any error status counts as a refusal, but the in-process test
client re-raised the app's exception instead of returning a 500 (fix: [langflow-s3-copy-refusal.patch](../../fixes/langflow-s3-copy-refusal.patch),
`raise_app_exceptions=False`). The 6 saved failing runs were re-graded on their saved `/workspace` with the task's own
verifier image and `tests/test.sh` ([regrade run 40518792254](https://github.com/sherazrazadev/swe-benching/actions/runs/40518792254)).
The control pass (unchanged tests) reproduced every original reward exactly.

| Run | Original | Control | Fixed tests | Still failing (fixed) |
|---|---|---|---|---|
| DeepSeek r1 | 0.9286 | 0.9286 | **1.0** | none |
| DeepSeek r2 | 0.7857 | 0.7857 | 0.8571 | lfx storage containment; account-level read on project server |
| DeepSeek r3 | 0.7857 | 0.7857 | 0.8571 | lfx storage containment; account-level read on project server |
| MiMo r1 | 0.7143 | 0.7143 | 0.7857 | lfx storage containment; cross-project read; account-level read on project server |
| MiMo r2 | 0.0 | 0.0 | 0.0 | own copy (functional); account-level read on project server |
| MiMo r3 | 0.9286 | 0.9286 | 0.9286 | account-level read on project server |

Result: DeepSeek solves the task under the corrected test, so it is REJECTED (not a both-model breaker).
