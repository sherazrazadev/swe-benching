package io.bench.oauth2.security;

import io.bench.oauth2.Check;
import io.bench.oauth2.Harness;
import org.junit.jupiter.api.Test;

/**
 * The older authorization mapping is still reachable and must make the same target decision, and a
 * code issued there must still be bound to the target it was issued for.
 */
class LegacyAuthorizationTest {

    private Harness harness() {
        return new Harness().standardClients();
    }

    @Test
    void legacyRejectsForeignTarget() {
        Check.refusedRedirect(
            harness().legacyAuthorize(Harness.CLIENT_ID, "https://attacker.test/cb"),
            "attacker.test");
    }

    @Test
    void legacyRejectsSiblingPath() {
        Check.refusedRedirect(
            harness().legacyAuthorize(Harness.CLIENT_ID, Harness.CALLBACK + "2"),
            Harness.CALLBACK + "2");
    }

    @Test
    void legacyRejectsLookalikeHost() {
        Check.refusedRedirect(
            harness().legacyAuthorize(Harness.ORIGIN_CLIENT_ID,
                                      "https://trusted.example.com.attacker.test/cb"),
            "attacker.test");
    }

    @Test
    void legacyIssuedCodeIsBoundToItsTarget() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.legacyAuthorize(Harness.CLIENT_ID, Harness.CALLBACK + "/next"),
            Harness.CALLBACK + "/next");
        Check.refusedToken(
            harness.exchangeGet(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code,
                                Harness.CALLBACK + "/other"));
    }
}
