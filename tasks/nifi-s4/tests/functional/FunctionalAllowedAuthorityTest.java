/*
 * An allowed public address keeps its declared port whether the port travels with the host or is
 * stated alongside it, exactly as the application does today.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_PUBLIC_PORT;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class FunctionalAllowedAuthorityTest {
    private static final String PROXY_HOST_HEADER = "X-ProxyHost";

    private static final String PROXY_PORT_HEADER = "X-ProxyPort";

    private static final String FORWARDED_HOST_HEADER = "X-Forwarded-Host";

    private static final String FORWARDED_PORT_HEADER = "X-Forwarded-Port";

    private static final String ALLOWED_ADDRESS =
            ALLOWED_HOST + ":" + ALLOWED_PUBLIC_PORT;

    @Test
    void allowedHostWithConfiguredPortIsAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture, PROXY_HOST_HEADER, ALLOWED_ADDRESS);
            assertAddressAdvertised(response, ALLOWED_HOST, ALLOWED_PUBLIC_PORT);
        }
    }

    @Test
    void allowedHostWithSeparateProxyPortIsAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    PROXY_HOST_HEADER, ALLOWED_HOST,
                    PROXY_PORT_HEADER, Integer.toString(ALLOWED_PUBLIC_PORT));
            assertAddressAdvertised(response, ALLOWED_HOST, ALLOWED_PUBLIC_PORT);
        }
    }

    @Test
    void allowedHostWithSeparateForwardedPortIsAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HOST_HEADER, ALLOWED_HOST,
                    FORWARDED_PORT_HEADER, Integer.toString(ALLOWED_PUBLIC_PORT));
            assertAddressAdvertised(response, ALLOWED_HOST, ALLOWED_PUBLIC_PORT);
        }
    }

    @Test
    void allowedHostWithConfiguredPortIsAdvertisedOnPlainConnection() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttp()) {
            final ProxyAddressTestSupport.Response response = get(fixture, PROXY_HOST_HEADER, ALLOWED_ADDRESS);
            assertAddressAdvertised(response, ALLOWED_HOST, ALLOWED_PUBLIC_PORT);
        }
    }
}
