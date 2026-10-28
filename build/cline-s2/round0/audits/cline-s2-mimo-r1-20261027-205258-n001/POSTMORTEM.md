# Post-run audit: cline-s2__oBbXVfa

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.875.

**Trustworthy:** False  **Attribution:** instruction-ambiguity  **Confidence:** medium

The model built a single shared origin/host guard (sdk/packages/shared/src/local-service-guard.ts) and wired it into the dashboard (/browser, /settings/live, POST /api/desktop-command), the desktop sidecar (/transport, /shutdown) and the SDK hub. It covered every sibling: 14/16 security tests passed, plus every functional and project test. The two failures are both in dashboard_socket.test.ts: 'right machine on another port' (Origin http://127.0.0.1:9999) and 'another scheme' (Origin https://127.0.0.1:<port>). Both fail because the model matched origins by hostname only and treated any loopback origin as the deployment's own. It chose this on purpose, citing the instruction's preservation clause: 'a connection from the product's own local front end must still be accepted when that front end is served from a different local port than the service it connects to' (instruction.md:32-33). That clause does not say which service it covers. The reference fix applies it only to the desktop bridge, which accepts any loopback origin on any port (fix.patch:322-338). The dashboard gets an exact scheme+host+port allowlist (fix.patch:209-227). Nothing in the instruction says the dashboard must be stricter than the bridge. The repository's own SDK hub also already accepts any loopback origin by design (build-notes.md:81-83). So the hidden test asks the dashboard to refuse the very 'same machine, other port' origin that the instruction tells solvers to keep accepting. The model's port-insensitive design is weaker in practice, because any other local web server can drive the dashboard. A stricter reader of 'an address the deployment is configured to serve' could have passed. Still, the clash between the clause and the test is large enough that the 0.875 does not cleanly measure the model's skill. No contamination, no harness problems, and no tool calls during the grading window.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/dashboard_socket.test.ts::dashboard browser socket > refuses an upgrade from the right machine on another port | fail | instruction-ambiguity | False | True |
| security/dashboard_socket.test.ts::dashboard browser socket > refuses an upgrade that uses another scheme | fail | instruction-ambiguity | False | True |

**Lookup or leak:** None found. The transcript (340 lines) contains no access to hidden tests (.htests, tests/security, test file names), no web lookups, and no git history or upstream commit references. The agent worked only from repository source and its own tests. run.json shows 0 agent events after agent_end and no tool calls during the grading window.

**Evidence:**
- grading/results.json:13-14 - the only two failures are the dashboard 'another port' and 'another scheme' cases; all other 14 security and all functional/project tests pass
- instruction.md:18-22 - 'A request whose origin is not an address the deployment is configured to serve ... must be refused'
- instruction.md:32-33 - 'a connection from the product's own local front end must still be accepted when that front end is served from a different local port than the service it connects to' (service not specified)
- tests/security/dashboard_socket.test.ts:45-59 - origin http://127.0.0.1:9999 and https://127.0.0.1:<port> must get a 4xx
- solution/fix.patch:209-227 - reference dashboard allowlist is exact origin (scheme+host+listening port)
- solution/fix.patch:322-338 - reference sidecar accepts any loopback origin regardless of port, i.e. the same rule the model applied everywhere
- build-notes.md:81-83 - SDK hub 'permits any loopback origin intentionally, and the project's own test asserts http://localhost:3000 is trusted'
- transcript.md:138 - model plan: 'loopback for local front ends — ports ignored'
- transcript.md:323 - 'Product local front end on a different local port (e.g. localhost:5173): accepted via loopback equivalence.'
- final-code/changes.patch:589-595 - local-service-guard.ts doc: 'Ports are deliberately ignored when matching'
- run.json:13-19 - agent ended before grading window; tool_calls_during_grading empty; exception_info null
- build-notes.md:26-30 - L1 lever explicitly includes 'another local port, another scheme' for the dashboard, which the instruction does not convey

**Recommended action:** Do not report 0.875 as a clean model-failed result. Fix the task: either scope the 'different local port' preservation clause to the desktop application's bridge, or state that the dashboard accepts only its own exact origin (scheme, host and listening port) and its configured public address. Alternatively, drop the wrong-port and wrong-scheme dashboard cases. Then re-run or re-score. Under the current instruction this trial is best treated as a near-solve (all siblings and preservation clauses handled) and excluded from model-failure statistics.
