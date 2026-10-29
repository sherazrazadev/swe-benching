# Post-run audit: nifi-s4__cxELtRr

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

The model fixed the bug in the shared resolver. It put an allow-list check in StandardRequestUriProvider/RequestUriBuilder, which reads a new 'allowedHosts' servlet init parameter. JettyServer.loadWar fills that parameter from NiFiProperties.getAllowedHosts(), following the same pattern the code already uses for 'allowedContextPaths'. The hidden-test harness (ProxyAddressTestSupport.start) builds the server with StandardServerProvider.getServer(properties) and then adds LogoutCompleteRedirectFilter in a bare ServletContextHandler that has no init parameters. In the harness, then, the model's allow-list is always empty. Every proxy host falls back to request.getServerName() ('localhost') and every proxy port falls back to the server port. As a result all 11 security tests and the direct-request tests pass, and all 12 'allowed address is still advertised' functional tests fail. The harness only works for fixes placed at the Jetty connector/customizer layer, which is where the reference fix and oracle put them. The instruction never names a layer or says how the configuration must reach the code. In real use, the model's logic handles each functional case correctly once the allow-list is filled in: host:port matching, a separate X-ProxyPort/X-Forwarded-Port, the last value of a repeated header, and RFC 7239 host= with or without quotes. So the 0.0 reward measures where the harness wires its configuration, not whether the fix is right. Confidence is medium, not high, for two reasons: I could not run the code, and I could not see JettyServer's filter registration directly. The transcript shows the UI and API contexts are created through loadWar (transcript.md:390), and the model's own unit tests of the filter and resolver pass with the parameter set (transcript.md:335).

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertised | fail | test-fault | False | False |
| FunctionalAllowedAuthorityTest::allowedHostWithSeparateProxyPortIsAdvertised | fail | test-fault | False | False |
| FunctionalAllowedAuthorityTest::allowedHostWithSeparateForwardedPortIsAdvertised | fail | test-fault | False | False |
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertisedOnPlainConnection | fail | test-fault | False | False |
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnPlainConnection | fail | test-fault | False | False |
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnSecureConnection | fail | test-fault | False | False |
| FunctionalAllowedHostTest::allowedForwardedHostIsAdvertisedOnPlainConnection | fail | test-fault | False | False |
| FunctionalAllowedHostTest::allowedForwardedHostIsAdvertisedOnSecureConnection | fail | test-fault | False | False |
| FunctionalRepeatedForwardedHostTest::valuesOfAnAllowedForwardingChainAreAdvertised | fail | test-fault | False | False |
| FunctionalRepeatedForwardedHostTest::repeatedIdenticalAllowedValueIsAdvertised | fail | test-fault | False | False |
| FunctionalStandardForwardedHeaderTest::quotedAllowedHostParameterIsAdvertised | fail | test-fault | False | False |
| FunctionalStandardForwardedHeaderTest::allowedHostParameterIsAdvertised | fail | test-fault | False | False |
| Security* (all 11 security tests) | pass | unclear | True | True |

**Lookup or leak:** No evidence of contamination. The transcript shows the agent reading only product source and the project's own tests under /workspace: StandardServerProvider, JettyServer, StandardServerProviderTest and LogoutCompleteRedirectFilterTest. It made no network or upstream lookups and never read the hidden tests. No netguard.log was supplied. run.json shows zero tool calls during the grading window.

**Evidence:**
- evidence/tests/support/ProxyAddressTestSupport.java:92-102 - the server comes from StandardServerProvider.getServer(properties), and LogoutCompleteRedirectFilter is added to a new ServletContextHandler() with no init parameters (no 'allowedHosts' or 'allowedContextPaths')
- evidence/tests/support/ProxyAddressTestSupport.java:85 - the allowed addresses reach the code only through NiFiProperties.WEB_PROXY_HOST
- evidence/final-code/changes.patch:38 - JettyServer.loadWar: webappContext.getInitParams().put(ALLOWED_HOSTS_PARAMETER, props.getAllowedHosts())
- evidence/final-code/changes.patch:190-198 - RequestUriBuilder reads the allowedHosts servlet init parameter and passes it to StandardRequestUriProvider
- evidence/final-code/changes.patch:322-336 - when a host or port is not allowed, the code falls back to request.getServerName()/getServerPort()
- evidence/solution/fix.patch:26,34-35 - the reference fix validates at the connector layer (ProxyHeaderValidatorCustomizer in FrameworkServerConnectorFactory), so it sees NiFiProperties directly
- evidence/build-notes.md:116 - the 'refuse_all' check patch is declared functional_fail (13); the model's graded behaviour (12 functional failures, all security passes) matches what refuse-all produces in this harness
- evidence/instruction.md:19-33 - states the property and the must-keep behaviour, but never says which layer must enforce it or how the configuration reaches it
- evidence/transcript.md:335 - the model's added LogoutCompleteRedirectFilterTest cases (allowed host advertised, attacker host rejected) pass when the init parameter is set
- evidence/transcript.md:390 - JettyServer creates the UI and API web contexts through loadWar, so the model's init parameter reaches them in production
- evidence/grading/results.json:16-34 - all 12 failing tests are 'allowed address advertised' functional tests; direct-request and connector tests pass
- evidence/run.json - tool_calls_during_grading is empty; test-stdout.tail.txt is empty, so no per-assertion output was available

**Recommended action:** Do not count this 0.0 as a model failure. Change the harness to run the filter in a context configured the way production configures it: either build it through the product's own web-context wiring, or set the 'allowedHosts'/'allowedContextPaths' init parameters from the same NiFiProperties the way JettyServer does. Alternatively, change the instruction to require enforcement at the connector/request-customizer level. Then re-grade this trial's final code, ideally checking whether LogoutCompleteRedirectFilter is registered on a loadWar-created context in production. If the re-grade passes the functional group, record this run as model-solved.
