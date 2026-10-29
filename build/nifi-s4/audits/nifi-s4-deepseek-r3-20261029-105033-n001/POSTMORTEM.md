# Post-run audit: nifi-s4__dF5QvHp

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** False  **Attribution:** test-fault  **Confidence:** medium

Reward 0.0: all 11 security tests fail and all 19 functional tests pass. The model wrote a real allow-list check in the shared URL resolver (StandardRequestUriProvider / RequestUriBuilder). It gets the allowed hosts from a servlet-context init parameter, 'allowedHosts', which JettyServer.loadWar now sets on every web-app context it creates. The hidden harness never builds a context through JettyServer.loadWar. ProxyAddressTestSupport.java:92-104 starts StandardServerProvider and adds LogoutCompleteRedirectFilter to a bare ServletContextHandler that has no init parameters. In that setup the model's RequestUriBuilder finds no allowedHosts parameter and keeps the old unvalidated behaviour (changes.patch:57-62, 93-95). So every security test sees the attacker host, which is identical to the nop result. The only way to pass this harness is to put validation in the connector/server layer, which is where the reference fix lives (fix.patch: ProxyHeaderValidatorCustomizer added in FrameworkServerConnectorFactory). The instruction never names a layer or a configuration channel. On the request paths the model wired up, its logic appears to cover the tested variants: unlisted X-ProxyHost and X-Forwarded-Host, separate and embedded unlisted ports, repeated X-Forwarded-Host (last value), and Forwarded host= (falls back to the arrival address). The failures therefore measure where the fix sits, not whether the property holds. Two things temper this. First, the model's design fails open whenever the init parameter is missing, a weakness the instruction's 'whatever connection it arrives on' wording arguably covers. Second, I could not confirm from this folder that production registers LogoutCompleteRedirectFilter on a loadWar-created context. Confidence is medium for those reasons.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| org.apache.nifi.web.server.SecurityProxyHostHeaderTest::secureRequestWithUnlistedProxyHostIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityProxyHostHeaderTest::secureRequestWithUnlistedForwardedHostIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityProxyHostHeaderTest::plainRequestWithUnlistedProxyHostIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityProxyHostHeaderTest::plainRequestWithUnlistedForwardedHostIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityProxyPortHeaderTest::secureRequestWithUnlistedForwardedPortIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityProxyPortHeaderTest::secureRequestWithUnlistedPortInProxyHostIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityProxyPortHeaderTest::plainRequestWithUnlistedProxyPortIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityProxyPortHeaderTest::secureRequestWithUnlistedProxyPortIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityRepeatedForwardedHostTest::allowedValueFollowedByUnlistedValueIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityStandardForwardedHeaderTest::quotedUnlistedHostParameterIsNotAdvertised | fail | test-fault | True | False |
| org.apache.nifi.web.server.SecurityStandardForwardedHeaderTest::unlistedHostParameterIsNotAdvertised | fail | test-fault | True | False |
| Functional* (all 19, e.g. FunctionalAllowedHostTest::allowedProxyHostIsAdvertisedOnPlainConnection) | pass | lenient-test | True | True |

**Lookup or leak:** No leak found. The agent did look for grader material: transcript.md:104 searched for task/grade/test-patch files, :108 listed /logs/verifier (empty), :110 grepped /logs /home /opt /tmp for 'attacker.invalid|logout-complete' and found only its own session logs, and :124 grepped /opt/m2 for fixed-implementation strings with no hits. It never read the hidden tests or the reference fix. No upstream lookup happened: there is no network, and the mvnw wget failed (transcript.md:131). No netguard.log is present.

**Evidence:**
- evidence/tests/support/ProxyAddressTestSupport.java:92-104: the harness uses StandardServerProvider plus a bare ServletContextHandler with LogoutCompleteRedirectFilter and no init params; allowed hosts reach only NiFiProperties (line 85)
- evidence/final-code/changes.patch:57-62: when the allowedHosts init param is absent, RequestUriBuilder uses the old StandardRequestUriProvider(allowedContextPaths) with no host validation
- evidence/final-code/changes.patch:766-770: JettyServer.loadWar puts allowedHosts=props.getAllowedHostsAsList() into each WebAppContext's init params, the only place it is supplied
- evidence/solution/fix.patch:34-35: the reference fix adds ProxyHeaderValidatorCustomizer at the connector layer (FrameworkServerConnectorFactory), the layer the harness exercises
- evidence/instruction.md:21-27: the security property is stated without naming a layer or configuration channel; 'whatever connection it arrives on'
- evidence/build-notes.md:98,109: in the nop run every security test fails and every functional test passes, the same pattern as this trial, so the graded result cannot tell this submission apart from no fix
- evidence/grading/results.json: 11/11 security fail, 19/19 functional pass, reward 0.0
- evidence/run.json: no tool calls during the grading window, exception_info null; evidence/grading/test-stdout.tail.txt is empty (no infra error visible)
- transcript.md:30-33,50-52: the agent read FrameworkServerConnectorFactory and HostPortValidatorCustomizer (the connector-layer pattern) but chose the resolver layer
- Unverified: where production JettyServer registers LogoutCompleteRedirectFilter (the full transcript outside this folder was not readable)

**Recommended action:** Do not count this 0.0 as a model failure. Change the harness so a resolver-layer fix can be exercised through the product's real configuration path, for example by building the context through JettyServer/loadWar or by passing the same init params the product sets. Alternatively, have the instruction say that the protection must not depend on per-web-app configuration. Then regrade this trial. Optionally, confirm that the production logout-complete filter sits on a loadWar context. If it does not, the model's fail-open default is a real gap and the attribution would change to model-failed.
