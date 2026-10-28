# Post-run audit: cline-s2__qcy7MUn

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** high

Reward 0.0 is a fair measure. The model hardened the cline-hub dashboard and the core hub server but never touched the desktop-app sidecar's /transport WebSocket, which it had read (transcript.md:73-74, 125-126, 275-276). As a result all 3 sidecar security tests fail. That alone forces reward 0, and those tests are squarely within the instruction ('desktop application' front end; 'the property applies to every way a request can reach one of these services'). On the dashboard, the model chose to accept loopback origins on ANY port and with any http(s) scheme, so it fails the 'another port' and 'another scheme' upgrade tests. The 'another port' case is somewhat ambiguous, because the instruction's 'different local port' preservation clause could be read as covering the dashboard (the reference fix applies it only to the sidecar). The 'another scheme' case is a plain over-acceptance. The model also broke a stated preservation clause: when PUBLIC_URL is a bare IP with no port (http://100.82.5.118), its origin check rejects the origin http://100.82.5.118:<port> that the page is actually served from (request-policy.ts compares origin to publicUrl.origin exactly and otherwise only allows listen/interface hosts), so both functional public-address tests get 403. No harness errors (exception_info null, no tool calls during grading), and no contamination.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| security/sidecar_transport.test.ts::desktop bridge socket > refuses a socket opened by another site | fail | genuine-fail | True | True |
| security/sidecar_transport.test.ts::desktop bridge socket > refuses a socket opened without an origin | fail | genuine-fail | True | True |
| security/sidecar_transport.test.ts::desktop bridge socket > refuses a socket opened with an unparseable origin | fail | genuine-fail | True | True |
| security/dashboard_socket.test.ts::dashboard browser socket > refuses an upgrade from the right machine on another port | fail | instruction-ambiguity | False | True |
| security/dashboard_socket.test.ts::dashboard browser socket > refuses an upgrade that uses another scheme | fail | genuine-fail | True | True |
| functional/dashboard_public_address.test.ts::configured public addresses > keeps a shared machine address usable when it has no port of its own | fail | genuine-fail | True | True |
| functional/dashboard_public_address.test.ts::configured public addresses > keeps replayed dashboard commands usable through that address | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only local repo exploration, local Bun probes and the repo's own vitest suites. There is no web or advisory lookup and no access to the hidden tests directory. No netguard log was provided.

**Evidence:**
- grading/results.json:13-18: the dashboard another-port and another-scheme tests fail, and all 3 sidecar_transport tests fail
- grading/results.json:21-22: both public-address functional tests fail (bare-IP PUBLIC_URL)
- final-code/changes.patch: no hunk touches apps/examples/desktop-app/sidecar/server.ts
- transcript.md:73-74 Read sidecar/server.ts; transcript.md:125-126 grep shows '/transport' && server.upgrade(req) still unguarded
- changes.patch:999-1002 request-policy.ts: 'if (isLoopbackHostName(hostName)) { return true; }' accepts any loopback port and scheme
- changes.patch:1003-1016: the only non-loopback accepts are an exact publicUrl.origin match or listen/interface hosts on http with the listening port, so http://100.82.5.118:<port> is rejected
- instruction.md:31-35 preservation clause: bare machine address with no port must keep working
- instruction.md:3-6 and 37-38: desktop application front end; 'the property applies to every way a request can reach one of these services'
- solution/fix.patch:314-354 reference guards the sidecar /transport (it allows any loopback port there); fix.patch:15-17 normalizes a bare-IP PUBLIC_URL by adding the dashboard port
- run.json: exception_info null, tool_calls_during_grading [] (no infra issue)

**Recommended action:** Accept the 0.0 as a genuine model failure. Optionally tighten instruction.md so it says which service the 'front end served from a different local port' clause applies to (the desktop sidecar), since that clause can be read as permitting cross-port loopback origins on the dashboard. This does not change this trial's outcome: the unfixed sidecar alone forces reward 0.
