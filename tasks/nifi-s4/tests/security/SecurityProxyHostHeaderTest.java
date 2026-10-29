/*
 * A proxy address header naming a host the administrator did not allow must never become the
 * authority of a generated absolute URL.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ATTACKER_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressNotAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class SecurityProxyHostHeaderTest {
    private static final String PROXY_HOST_HEADER = "X-ProxyHost";

    private static final String FORWARDED_HOST_HEADER = "X-Forwarded-Host";

    @Test
    void secureRequestWithUnlistedProxyHostIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture, PROXY_HOST_HEADER, ATTACKER_HOST);
            assertAddressNotAdvertised(response, ATTACKER_HOST);
        }
    }

    @Test
    void secureRequestWithUnlistedForwardedHostIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture, FORWARDED_HOST_HEADER, ATTACKER_HOST);
            assertAddressNotAdvertised(response, ATTACKER_HOST);
        }
    }

    @Test
    void plainRequestWithUnlistedProxyHostIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttp()) {
            final ProxyAddressTestSupport.Response response = get(fixture, PROXY_HOST_HEADER, ATTACKER_HOST);
            assertAddressNotAdvertised(response, ATTACKER_HOST);
        }
    }

    @Test
    void plainRequestWithUnlistedForwardedHostIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttp()) {
            final ProxyAddressTestSupport.Response response = get(fixture, FORWARDED_HOST_HEADER, ATTACKER_HOST);
            assertAddressNotAdvertised(response, ATTACKER_HOST);
        }
    }
}
