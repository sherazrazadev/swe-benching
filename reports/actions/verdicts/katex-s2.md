# `katex-s2`: REJECTED

**Why:** solved by deepseek.

- A math typesetting library lets a value planted on JavaScript's shared object prototype make untrusted input trusted, so attacker-supplied links, images and HTML attributes are rendered.
- CWE-807, TypeScript, https://github.com/KaTeX/KaTeX
- Batch 8, [run 40606332971](https://github.com/sherazrazadev/swe-benching/actions/runs/40606332971) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40606332971)
- Trials: DeepSeek 1 / MiMo 0.9091

## Fairness review: READY

Full review: [katex-s2-FAIRNESS.md](katex-s2-FAIRNESS.md)

## Audits of the failing runs (1/1 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
| [mimo](../audits/katex-s2-mimo-r1-20261028-132958-n001/POSTMORTEM.md) | 0.9091 | True | model-failed (medium) | Reward 0.9091 = 20/22 security tests passed, with every functional test passing (score.py threshold formula). Both failures are in security/test_auto_render_options.spec.ts. The model made a broad prototype-pollution hardening across ~44 core src/ files (Namespace, Settings, html.ts, symbol/spacing tables, array env, etc.) but never modified contrib/auto-render/auto-render.ts. That file still builds its options copy from a plain {} and so picks up `delimiters`/`macros` planted on Object.prototype. The instruction requires the property to hold 'for every way the library consumes caller input'. auto-render ships with KaTeX (imported as katex/contrib/auto-render) and consumes caller options, and the reference fix patches exactly this file (Object.create(null) for optionsCopy). So a reasonable correct fix would pass these tests. The model's transcript shows it listed /workspace/contrib/auto-render early (transcript.md:68-71) and then never returned to it. The agent hit the 3h AgentTimeoutError, but run.json shows no tool calls inside the grading window, so the graded code is the final code. I found no evidence that the agent read the hidden tests or fetched the upstream fix. Small caveat: someone could read 'the library' as core KaTeX only, which is why confidence is medium rather than high. |
