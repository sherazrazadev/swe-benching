/*
 * The structured standard forwarding header keeps carrying an allowed public host, quoted or not.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST_WITH_PORT;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class FunctionalStandardForwardedHeaderTest {
    private static final String FORWARDED_HEADER = "Forwarded";

    @Test
    void allowedHostParameterIsAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HEADER, "for=192.0.2.60;proto=https;host=" + ALLOWED_HOST);
            assertAddressAdvertised(response, ALLOWED_HOST, null);
        }
    }

    @Test
    void quotedAllowedHostParameterIsAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HEADER, "for=192.0.2.60;host=\"" + ALLOWED_HOST_WITH_PORT + "\"");
            assertAddressAdvertised(response, ALLOWED_HOST_WITH_PORT, null);
        }
    }
}
