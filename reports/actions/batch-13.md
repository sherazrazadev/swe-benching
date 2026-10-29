# Batch 13

Started 2026-10-28T20:30Z. [run 40763748092](https://github.com/sherazrazadev/swe-benching/actions/runs/40763748092) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40763748092)

| Task | Gate | DeepSeek rewards | MiMo rewards | Outcome |
|---|---|---|---|---|
| `ansible-s5` | sound | 1 | 1 | **REJECTED** |
| `aqua-s5` | sound | 0 | 1 | **REJECTED** |
| `cms-s5` | sound | 1 | 1 | **REJECTED** |
| `dompurify-s5` | sound | 1 | 1 | **REJECTED** |
| `git-js-s5` | sound | 0.5185 0.3704 0.2593 | 0 0.3704 0.2593 0 0 | **ACCEPTED** |
| `gonic-s5` | sound | 1 | 1 | **REJECTED** |

## Accepted tasks

### `git-js-s5`

- Caller-supplied values can still reach git configuration, command options and operands that make an operation run a program of the caller's choosing.
- CWE-184, TypeScript, https://github.com/steveukx/git-js
- DeepSeek 0.5185 0.3704 0.2593 / MiMo 0 0.3704 0.2593 0 0
- [Final verdict details](verdicts/git-js-s5.md)
