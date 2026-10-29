# Post-run audit: nifi-s4__TyeadAX

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.0 comes from 13 functional failures; all 11 security tests pass. The model validated proxy host and port values inside the shared URL resolver (StandardRequestUriProvider). It got the allowed hosts from a new 'allowedHosts' servlet-context init parameter, which JettyServer.loadWar fills from nifi.web.proxy.host. This copies how the codebase already passes 'allowedContextPaths' to the same resolver. The hidden-test harness (ProxyAddressTestSupport) does not deploy a webapp. It builds the server with StandardServerProvider.getServer(properties) and adds LogoutCompleteRedirectFilter in a bare ServletContextHandler with no init parameters, so the declared allowed hosts can reach product code only through server/connector-level wiring. Under this harness the model's resolver sees an empty allow-list and refuses every proxy header with 400. The 13 failures match exactly the build's 'refuse_all functional_fail (13)' control. That means the graded outcome measures 'did the fix live at the Jetty connector layer' (as the reference ProxyHeaderValidatorCustomizer does), not 'are allowed addresses still advertised'. The instruction never names a layer. Reading the model's code against each failing test's inputs, its logic would advertise the allowed addresses in those cases if the allow-list were present: host-only, host:port, separate X-ProxyPort/X-Forwarded-Port, repeated values (last one used), and RFC 7239 host=. One failing test (proxyHostEqualToRequestHostIsAdvertised) also requires an undeclared 'X-ProxyHost: localhost' to be honoured. The instruction does not state this exemption, and its security property arguably forbids it. Residual uncertainty, which is why confidence is medium rather than high: I could not confirm from this folder that the production LogoutCompleteRedirectFilter is registered in a WebAppContext created by loadWar, and the code was not run. No contamination found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnSecureConnection / allowedProxyHostIsAdvertisedOnPlainConnection / allowedForwardedHostIsAdvertisedOnSecureConnection / allowedForwardedHostIsAdvertisedOnPlainConnection (4 fails) | fail | test-fault | True | False |
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertised / allowedHostWithSeparateProxyPortIsAdvertised / allowedHostWithSeparateForwardedPortIsAdvertised / allowedHostWithConfiguredPortIsAdvertisedOnPlainConnection (4 fails) | fail | test-fault | True | False |
| FunctionalRepeatedForwardedHostTest::valuesOfAnAllowedForwardingChainAreAdvertised / repeatedIdenticalAllowedValueIsAdvertised (2 fails) | fail | test-fault | True | False |
| FunctionalStandardForwardedHeaderTest::allowedHostParameterIsAdvertised / quotedAllowedHostParameterIsAdvertised (2 fails) | fail | test-fault | True | False |
| FunctionalDirectRequestTest::proxyHostEqualToRequestHostIsAdvertised | fail | instruction-ambiguity | False | False |
| Security* (11 tests) | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The transcript has no access to /tests, the hidden test class names, or any network fetch (no matches for /tests, curl, wget, github, Functional*/Security* test names, or ProxyAddressTestSupport). No netguard.log is present. The model also never consulted the upstream fix: it did not add a connector customizer.

**Evidence:**
- evidence/tests/support/ProxyAddressTestSupport.java:92-102: the server is built via StandardServerProvider.getServer(properties); the filter is added in `new ServletContextHandler()` with no init params
- evidence/tests/support/ProxyAddressTestSupport.java:85: allowed hosts are given only as NiFiProperties WEB_PROXY_HOST, reachable only at server level
- evidence/final-code/changes.patch:417-419: RequestUriBuilder reads allowedHosts from a servlet-context init parameter
- evidence/final-code/changes.patch:826: `webappContext.getInitParams().put(ALLOWED_HOSTS_PARAMETER, props.getAllowedHosts())` in JettyServer.loadWar, mirroring the existing allowedContextPaths plumbing at the line above
- evidence/final-code/changes.patch:853-857: a disallowed address leads to 400 with no redirect
- evidence/solution/fix.patch:34-35: the reference adds ProxyHeaderValidatorCustomizer at the connector (FrameworkServerConnectorFactory), the only layer the harness wires properties into
- evidence/solution/fix.patch:208-213: the reference exempts a proxy host equal to the request host on secure requests; the instruction never states this
- evidence/build-notes.md:116: 'refuse_all functional_fail (13)'; this run has exactly 13 functional failures with all security tests passing
- evidence/grading/results.json: security 11/11 pass, functional 6/19 pass
- evidence/instruction.md:21-33: states the property and must-keep-working behaviours but no layer, and says nothing about exempting the request's own host
- evidence/run.json: tool_calls_during_grading is empty, exception_info is null, so there is no harness timing issue

**Recommended action:** Do not count this as a model failure. Fix the harness so a fix at the URL-generation layer can see the configured allowed hosts: either set the same servlet-context init parameters JettyServer.loadWar sets (allowedContextPaths, plus anything derived from nifi.web.proxy.host), or deploy the filter through the product's real webapp wiring. Alternatively, state in the instruction that enforcement must happen at the connector/server layer. Drop proxyHostEqualToRequestHostIsAdvertised, or state the request-host exemption in the instruction. Then regrade this trial. A manual check that the production LogoutCompleteRedirectFilter sits inside a loadWar WebAppContext would confirm the model's fix works end-to-end.
