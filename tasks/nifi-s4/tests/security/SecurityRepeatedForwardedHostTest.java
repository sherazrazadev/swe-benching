/*
 * A request may carry a forwarding header more than once. Every value it carries is covered by the
 * property: an allowed value followed by a disallowed one must not advertise the disallowed host.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ALLOWED_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.ATTACKER_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressNotAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class SecurityRepeatedForwardedHostTest {
    private static final String FORWARDED_HOST_HEADER = "X-Forwarded-Host";

    @Test
    void allowedValueFollowedByUnlistedValueIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HOST_HEADER, ALLOWED_HOST,
                    FORWARDED_HOST_HEADER, ATTACKER_HOST);
            assertAddressNotAdvertised(response, ATTACKER_HOST);
        }
    }

}
