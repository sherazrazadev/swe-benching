package io.bench.oauth2.functional;

import io.bench.oauth2.Check;
import io.bench.oauth2.Harness;
import org.junit.jupiter.api.Test;

/** The older authorization mapping is a working feature and must keep issuing for good callbacks. */
class LegacyMappingTest {

    private Harness harness() {
        return new Harness().standardClients();
    }

    @Test
    void legacyMappingStillIssuesForRegisteredCallback() {
        Check.issuedRedirect(
            harness().legacyAuthorize(Harness.CLIENT_ID, Harness.CALLBACK),
            Harness.CALLBACK);
    }

    @Test
    void legacyMappingAcceptsDeeperPath() {
        String target = Harness.CALLBACK + "/next";
        Check.issuedRedirect(harness().legacyAuthorize(Harness.CLIENT_ID, target), target);
    }
}
