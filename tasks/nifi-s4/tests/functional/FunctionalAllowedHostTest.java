/*
 * Every allowed public host keeps being advertised, on both kinds of connection and through either
 * of the proxy address header names the application supports.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST_WITH_PORT;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class FunctionalAllowedHostTest {
    private static final String PROXY_HOST_HEADER = "X-ProxyHost";

    private static final String FORWARDED_HOST_HEADER = "X-Forwarded-Host";

    @Test
    void allowedProxyHostIsAdvertisedOnSecureConnection() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture, PROXY_HOST_HEADER, ALLOWED_HOST);
            assertAddressAdvertised(response, ALLOWED_HOST, null);
        }
    }

    @Test
    void allowedForwardedHostIsAdvertisedOnSecureConnection() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture, FORWARDED_HOST_HEADER, ALLOWED_HOST_WITH_PORT);
            assertAddressAdvertised(response, ALLOWED_HOST_WITH_PORT, null);
        }
    }

    @Test
    void allowedProxyHostIsAdvertisedOnPlainConnection() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttp()) {
            final ProxyAddressTestSupport.Response response = get(fixture, PROXY_HOST_HEADER, ALLOWED_HOST);
            assertAddressAdvertised(response, ALLOWED_HOST, null);
        }
    }

    @Test
    void allowedForwardedHostIsAdvertisedOnPlainConnection() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttp()) {
            final ProxyAddressTestSupport.Response response = get(fixture, FORWARDED_HOST_HEADER, ALLOWED_HOST_WITH_PORT);
            assertAddressAdvertised(response, ALLOWED_HOST_WITH_PORT, null);
        }
    }
}
