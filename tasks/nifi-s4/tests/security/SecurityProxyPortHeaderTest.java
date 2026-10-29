/*
 * A proxy address header naming a host that is allowed must still not be able to advertise an
 * arbitrary port in the generated absolute URL.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.ATTACKER_PORT;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressNotAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class SecurityProxyPortHeaderTest {
    private static final String PROXY_HOST_HEADER = "X-ProxyHost";

    private static final String PROXY_PORT_HEADER = "X-ProxyPort";

    private static final String FORWARDED_PORT_HEADER = "X-Forwarded-Port";

    @Test
    void secureRequestWithUnlistedProxyPortIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    PROXY_HOST_HEADER, ALLOWED_HOST,
                    PROXY_PORT_HEADER, Integer.toString(ATTACKER_PORT));
            assertAddressNotAdvertised(response, ":" + ATTACKER_PORT);
        }
    }

    @Test
    void secureRequestWithUnlistedForwardedPortIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    PROXY_HOST_HEADER, ALLOWED_HOST,
                    FORWARDED_PORT_HEADER, Integer.toString(ATTACKER_PORT));
            assertAddressNotAdvertised(response, ":" + ATTACKER_PORT);
        }
    }

    @Test
    void secureRequestWithUnlistedPortInProxyHostIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    PROXY_HOST_HEADER, ALLOWED_HOST + ":" + ATTACKER_PORT);
            assertAddressNotAdvertised(response, ":" + ATTACKER_PORT);
        }
    }

    @Test
    void plainRequestWithUnlistedProxyPortIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttp()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    PROXY_HOST_HEADER, ALLOWED_HOST,
                    PROXY_PORT_HEADER, Integer.toString(ATTACKER_PORT));
            assertAddressNotAdvertised(response, ":" + ATTACKER_PORT);
        }
    }
}
