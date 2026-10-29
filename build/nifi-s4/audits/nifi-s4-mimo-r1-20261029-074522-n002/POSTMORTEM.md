# Post-run audit: nifi-s4__WVfQxTK

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.0 comes from 10 failing functional tests. Nine of them fail for a reason that has nothing to do with whether the model's allow-list logic is right. The model put validation in the shared servlet-layer resolver (StandardRequestUriProvider). It passes the declared hosts the same way the project already passes allowedContextPaths: as a WebAppContext init parameter set in JettyServer.loadWar, which is also where LogoutCompleteRedirectFilter is registered in production (transcript:75,77, JettyServer.java:722). The hidden harness does not use that path. ProxyAddressTestSupport.java:96-102 places LogoutCompleteRedirectFilter in a bare ServletContextHandler with no init params, so the model's allow-list is always empty there. Every proxy host is then refused with 400, and every 'allowed address is advertised' test fails because it requires a 302. The reference fix enforces at the Jetty connector (ProxyHeaderValidatorCustomizer in FrameworkServerConnectorFactory), and that is the only layer this harness can see. The instruction never names a layer. The tenth failure (proxyHostEqualToRequestHostIsAdvertised) needs an exemption for a proxy host equal to the request host. The instruction does not state that exemption, and the model's design would fail this test in production too. All 11 security tests pass, but only because the harness sees an empty allow-list and the model fails closed. They do not show that the model's per-value validation works end to end, though its logic reads as correct for the tested shapes (host:port, a separate port header, the last X-Forwarded-Host value, Forwarded host=). The agent also hit the 3-hour timeout while still updating project tests. No grading-window tool calls, no contamination.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnSecureConnection | fail | test-fault | True | False |
| FunctionalAllowedHostTest::allowedForwardedHostIsAdvertisedOnSecureConnection | fail | test-fault | True | False |
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnPlainConnection | fail | test-fault | True | False |
| FunctionalAllowedHostTest::allowedForwardedHostIsAdvertisedOnPlainConnection | fail | test-fault | True | False |
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertised | fail | test-fault | True | False |
| FunctionalAllowedAuthorityTest::allowedHostWithSeparateProxyPortIsAdvertised | fail | test-fault | True | False |
| FunctionalAllowedAuthorityTest::allowedHostWithSeparateForwardedPortIsAdvertised | fail | test-fault | True | False |
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertisedOnPlainConnection | fail | test-fault | True | False |
| FunctionalRepeatedForwardedHostTest::valuesOfAnAllowedForwardingChainAreAdvertised | fail | test-fault | True | False |
| FunctionalRepeatedForwardedHostTest::repeatedIdenticalAllowedValueIsAdvertised | fail | test-fault | True | False |
| FunctionalStandardForwardedHeaderTest::allowedHostParameterIsAdvertised | fail | test-fault | True | False |
| FunctionalStandardForwardedHeaderTest::quotedAllowedHostParameterIsAdvertised | fail | test-fault | True | False |
| FunctionalDirectRequestTest::proxyHostEqualToRequestHostIsAdvertised | fail | instruction-ambiguity | False | True |
| Security* (all 11 tests) | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The transcript shows no reads of /tests or the hidden test names, and no upstream lookup. The only network attempt was ./mvnw's wget of a Maven distribution, which failed (transcript:154); the agent then used the local offline mvn. No netguard.log is present. run.json shows tool_calls_during_grading: [], so the graded code is the code at agent timeout.

**Evidence:**
- evidence/tests/support/ProxyAddressTestSupport.java:92-102 — StandardServerProvider.getServer(properties), then a bare new ServletContextHandler() with LogoutCompleteRedirectFilter. No allowedContextPaths or allowedHosts init params, and JettyServer.loadWar is bypassed
- evidence/final-code/changes.patch:1019-1027 — JettyServer.loadWar puts ALLOWED_HOSTS_PARAMETER='allowedHosts' next to the existing allowedContextPaths init param
- evidence/final-code/changes.patch:42-50 — RequestUriBuilder reads allowed hosts from servletContext.getInitParameter; when the param is missing the list is empty
- evidence/final-code/changes.patch:266-281 — when a proxy header is present and the host is not in allowedHosts, it throws IllegalArgumentException
- evidence/final-code/changes.patch:1000-1009 — LogoutCompleteRedirectFilter maps that exception to 400, so functional tests expecting 302 fail
- evidence/transcript.md:75-77 — LogoutCompleteRedirectFilter is registered at JettyServer.java:722, inside loadWar (declared near line 706), so production would receive the init param
- evidence/transcript.md:123 — the model's stated design: 'plumb allowed hosts via an allowedHosts init parameter parallel to allowedContextPaths'
- evidence/solution/fix.patch:34-35 — the reference enforces at the connector (ProxyHeaderValidatorCustomizer in FrameworkServerConnectorFactory), the only layer the harness sees
- evidence/solution/fix.patch:208-214 — the reference exempts a proxy host equal to the request host on secure requests; instruction.md does not state this
- evidence/instruction.md:21-33 — states the property and what must keep working, but names no enforcement layer and no request-host exemption
- evidence/grading/results.json:16-34 — 10 functional failures, all in allowed-address and request-host-equal cases; direct requests and FunctionalProjectServerTest pass
- evidence/run.json — AgentTimeoutError after 10800 s; tool_calls_during_grading: []

**Recommended action:** Do not count this 0.0 as a model failure. Either build the harness context the way production does (route through JettyServer.loadWar, or copy its init params into the test ServletContextHandler), or state in the instruction that enforcement must happen in the connector/server layer. Then regrade. Separately, either state in the instruction that a proxy host equal to the request host is acceptable, or drop proxyHostEqualToRequestHostIsAdvertised. Note that the model's run ended in a timeout with project tests only partly updated.
