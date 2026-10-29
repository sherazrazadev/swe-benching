/*
 * A forwarding header that repeats for a legitimate chain of allowed proxies keeps being honored.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST_WITH_PORT;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class FunctionalRepeatedForwardedHostTest {
    private static final String FORWARDED_HOST_HEADER = "X-Forwarded-Host";

    @Test
    void valuesOfAnAllowedForwardingChainAreAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HOST_HEADER, ALLOWED_HOST,
                    FORWARDED_HOST_HEADER, ALLOWED_HOST_WITH_PORT);
            assertAddressAdvertised(response, ALLOWED_HOST_WITH_PORT, null);
        }
    }

    @Test
    void repeatedIdenticalAllowedValueIsAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HOST_HEADER, ALLOWED_HOST,
                    FORWARDED_HOST_HEADER, ALLOWED_HOST);
            assertAddressAdvertised(response, ALLOWED_HOST, null);
        }
    }
}
