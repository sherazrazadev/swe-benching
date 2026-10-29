# Post-run audit: nifi-s4__JHeiMHj

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.0 comes from 10 functional failures, all 'allowed address must still be advertised' cases. All 11 security tests pass. The model put the allow-list in the shared servlet-layer resolver (StandardRequestUriProvider / RequestUriBuilder). It reads the allowed hosts from a servlet-context init parameter 'allowedHosts', which JettyServer.loadWar fills from nifi.web.proxy.host. That is the same idiom the codebase already uses for allowedContextPaths. The hidden-test harness (ProxyAddressTestSupport) never calls loadWar. It builds a bare ServletContextHandler with no init parameters, gives NiFiProperties only to StandardServerProvider (the connector layer), and adds LogoutCompleteRedirectFilter directly. In the harness the model's allow-list is therefore always empty. Every proxy host, including the allowed ones, falls back to the server name, so every allowed-address test fails and every security test passes without testing anything. So the test effectively demands a fix at the Jetty connector layer (the oracle adds a ProxyHeaderValidatorCustomizer in FrameworkServerConnectorFactory), but the instruction never names a layer. Read statically, the model's logic would satisfy the functional cases if the configuration reached it: host:port parsing, a separate X-ProxyPort/X-Forwarded-Port, quoted RFC 7239 host=, and last-value repeated X-Forwarded-Host. The grade does not measure the model's work in either direction.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnSecureConnection / OnPlainConnection, allowedForwardedHostIsAdvertisedOnSecureConnection / OnPlainConnection (4 tests) | fail | test-fault | False | False |
| FunctionalAllowedAuthorityTest::allowedHostWithConfiguredPortIsAdvertised / allowedHostWithSeparateProxyPortIsAdvertised / allowedHostWithSeparateForwardedPortIsAdvertised / allowedHostWithConfiguredPortIsAdvertisedOnPlainConnection (4 tests) | fail | test-fault | False | False |
| FunctionalRepeatedForwardedHostTest::valuesOfAnAllowedForwardingChainAreAdvertised / repeatedIdenticalAllowedValueIsAdvertised (2 tests) | fail | test-fault | False | False |
| FunctionalStandardForwardedHeaderTest::allowedHostParameterIsAdvertised / quotedAllowedHostParameterIsAdvertised (2 tests) | fail | test-fault | False | False |
| Security* (all 11 tests, e.g. SecurityProxyHostHeaderTest::plainRequestWithUnlistedProxyHostIsNotAdvertised, SecurityRepeatedForwardedHostTest::allowedValueFollowedByUnlistedValueIsNotAdvertised) | pass | lenient-test | True | True |

**Lookup or leak:** No contamination found. The agent did go looking for grader material: it listed /, /logs, /logs/verifier, /logs/artifacts and the installed-agent/session files, and ran find for test/grader/eval directories (transcript.md:181-191). /logs/verifier and /logs/artifacts were empty and nothing from the hidden tests was found or read. No upstream fix was fetched (no network; it only inspected cached SNAPSHOT jars in /opt/m2, transcript.md:172-194, which predate the fix). No netguard.log is present.

**Evidence:**
- evidence/tests/support/ProxyAddressTestSupport.java:85 - allowed addresses are given only as NiFiProperties.WEB_PROXY_HOST to StandardServerProvider
- evidence/tests/support/ProxyAddressTestSupport.java:96-102 - bare ServletContextHandler with LogoutCompleteRedirectFilter and no init parameters (no loadWar / WebAppContext)
- evidence/final-code/changes.patch:63 - model wires 'allowedHosts' init param only in JettyServer.loadWar
- evidence/final-code/changes.patch:553-569 - RequestUriBuilder returns an empty allow-list when no init parameter is present
- evidence/final-code/changes.patch:271-274 - a proxy host not in the allow-list falls back to serverName, so in the harness every allowed-host case fails
- evidence/transcript.md:164-165,195-196 - the agent found the existing allowedContextPaths init-param idiom in loadWar and copied it
- evidence/transcript.md:442 - the agent's summary of the wiring: 'JettyServer.loadWar populates it from props.getAllowedHostsAsList()'
- evidence/solution/fix.patch:34-38 - the oracle validates in a Jetty HttpConfiguration.Customizer at the connector, the only layer the harness gives configuration to
- evidence/instruction.md:21-33 - states the property and must-keep-working behaviour but no implementation layer or configuration channel
- evidence/build-notes.md:73-75 - the task author treats the logout filter as an entry point only; no servlet-layer fix variant appears among the validated alternatives
- evidence/run.json timing - no tool calls during the grading window; exception_info null; test-stdout tail empty but results.json complete (30 results)

**Recommended action:** Do not count this 0.0 as a model failure. Fix the harness so any reasonable layer receives the configuration. Either load the filter in a context that gets the same init parameters as JettyServer.loadWar (allowedContextPaths/allowedHosts derived from NiFiProperties), or drive the test through JettyServer itself. Alternatively, state in the instruction that the check must happen at the HTTP connector. Then regrade this trial. Also add a servlet-layer alternative fix to the patch gate so this blind spot is caught.
