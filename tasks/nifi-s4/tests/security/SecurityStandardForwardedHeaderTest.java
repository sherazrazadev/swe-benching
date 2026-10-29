/*
 * A proxy address may also arrive in the standard forwarding header, which reports the original
 * host as a structured parameter. A host the administrator did not allow must not be advertised.
 */
package org.apache.nifi.web.server;

import org.junit.jupiter.api.Test;

import static org.apache.nifi.web.server.ProxyAddressTestSupport.ATTACKER_HOST;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.assertAddressNotAdvertised;
import static org.apache.nifi.web.server.ProxyAddressTestSupport.get;

class SecurityStandardForwardedHeaderTest {
    private static final String FORWARDED_HEADER = "Forwarded";

    @Test
    void unlistedHostParameterIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HEADER, "for=192.0.2.60;proto=https;host=" + ATTACKER_HOST);
            assertAddressNotAdvertised(response, ATTACKER_HOST);
        }
    }

    @Test
    void quotedUnlistedHostParameterIsNotAdvertised() throws Exception {
        try (ProxyAddressTestSupport.Fixture fixture = ProxyAddressTestSupport.startHttps()) {
            final ProxyAddressTestSupport.Response response = get(fixture,
                    FORWARDED_HEADER, "for=192.0.2.60;host=\"" + ATTACKER_HOST + "\"");
            assertAddressNotAdvertised(response, ATTACKER_HOST);
        }
    }
}
