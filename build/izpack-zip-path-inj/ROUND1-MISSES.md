# Round 1 trial evidence: izpack-zip-path-inj (GitHub Actions batch 10, run 40647352109)

Hidden security tests (9) and which ones each graded run FAILED (functional 23/23 passed in every run):

| Run | Reward | Failed security tests (lever, see notes.md) |
|---|---|---|
| DeepSeek 1 | 0.7778 | relocatedEntryDoesNotEscapeInstallDirectory (S1), existingFileOutsideInstallDirectoryIsNotTouched (B1) |
| DeepSeek 2 | 0.5556 | refusesForwardSlashTraversal + refusesBackslashTraversal (L2), S1, B1 |
| DeepSeek 3 | 0.6667 | S1, B1, fileOutsideInstallDirectoryIsNotRewritten (B2) |
| MiMo 1 | 0.7778 | L2 (FileEntryApiSecurityTest, both forms) |
| MiMo 2 | 0.7778 | L2 (both forms) |
| MiMo 3 | 1.0 | none (solved) |

Reading: DeepSeek misses the real-upstream sibling features (B1 override rename, B2 parsable rewrite) and the
injected loose-file relocation (S1) every time: the DeepSeek side is strong. MiMo found S1/B1/B2 every run and
missed only the public API constructor in the separate izpack-api module (L2) in 2 of 3 runs, so MiMo is the
model that solved it. Round 2 should add MiMo-type traps of different kinds (BRIEF-trap-stack.md) and keep
L1, L2, B1, B2, S1, S2 as they are.
