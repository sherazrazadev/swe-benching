# `cline-s2`: REJECTED

**Why:** solved by deepseek.

- A local coding assistant's browser-facing services accept commands from any web page, letting an unrelated site drive the local runtime.
- CWE-346, TypeScript, https://github.com/cline/cline
- Batch 6, [run 40566307793](https://github.com/sherazrazadev/swe-benching/actions/runs/40566307793) · [results branch](https://github.com/sherazrazadev/swe-benching/tree/runs/40566307793)
- Trials: DeepSeek 1 / MiMo 0

## Fairness review: READY

Full review: [cline-s2-FAIRNESS.md](cline-s2-FAIRNESS.md)

## Audits of the failing runs (1/1 trustworthy)

| Model | Reward | Trustworthy | Attribution | Auditor's summary |
|---|---|---|---|---|
| [mimo](../audits/cline-s2-mimo-r1-20261028-135144-n002/POSTMORTEM.md) | 0 | True | model-failed (high) | Reward 0.0 reflects real gaps in the model's fix. (1) The model never touched the desktop-app sidecar's /transport WebSocket (apps/examples/desktop-app/sidecar/server.ts). Its own search found it (transcript.md:59), but it is missing from changes.patch, so all 6 sidecar_transport security tests fail: foreign, missing, empty and unparseable origins are all accepted. The instruction says the property 'applies to every way a request can reach one of these services' and to fix 'close variants ... regardless of how the request arrives'. (2) The model deliberately admits an origin-less request when it carries the room secret (deployment-address.ts checkLocalRequestAccess 'if (request.hasCredential) return { ok: true }'). The instruction says such a request 'must be refused with a client error'. The model even flags this as a judgment call (transcript.md:395), so the shared-address no-origin test fails. (3) Two functional public-address tests fail because the model maps PUBLIC_URL 'http://100.82.5.118' to port 80 only, so http://100.82.5.118:<dashboardPort> is refused. This is arguably covered by 'configured public address ... in whatever form clients and the configuration present it', but the bare-IP vs. tunnel-hostname distinction is somewhat subtle. Even if that item were discounted, failures (1) and (2) alone are clear model shortfalls that would give reward 0. There are no infra problems (no grading exception, no tool calls during the grading window) and no contamination. |
