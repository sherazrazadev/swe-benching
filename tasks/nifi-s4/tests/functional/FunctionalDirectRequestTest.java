/*
 * Requests that state no proxy address keep using the address they arrived on, on both kinds of
 * connection. A proxy address equal to the request's own host remains legitimate.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class FunctionalDirectRequestTest {
    private static final String LOCALHOST = "localhost";

    private static final String PROXY_HOST_HEADER = "X-ProxyHost";

    @Test
    void directSecureRequestKeepsRequestAddress() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture);
            assertAddressAdvertised(response, LOCALHOST, fixture.localPort());
        }
    }

    @Test
    void directPlainRequestKeepsRequestAddress() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttp()) {
            final ProxyAddressTestSupport.Response response = get(fixture);
            assertAddressAdvertised(response, LOCALHOST, fixture.localPort());
        }
    }

    @Test
    void proxyHostEqualToRequestHostIsAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture, PROXY_HOST_HEADER, LOCALHOST);
            assertAddressAdvertised(response, LOCALHOST, null);
        }
    }
}
