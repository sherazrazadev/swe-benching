package io.bench.oauth2.security;

import io.bench.oauth2.Check;
import io.bench.oauth2.Harness;
import org.junit.jupiter.api.Test;

/**
 * A code is issued for one redirect target; redeeming it while presenting another target (or none,
 * after a non-default target was used) must not yield a token.
 */
class TokenBindingTest {

    private Harness harness() {
        return new Harness().standardClients();
    }

    @Test
    void tokenRejectsDifferentTargetOnGet() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, Harness.CALLBACK + "/next"),
            Harness.CALLBACK + "/next");
        Check.refusedToken(
            harness.exchangeGet(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code,
                                Harness.CALLBACK + "/other"));
    }

    @Test
    void tokenRejectsDifferentTargetOnPost() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, Harness.CALLBACK + "/next"),
            Harness.CALLBACK + "/next");
        Check.refusedToken(
            harness.exchangePost(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code,
                                 Harness.CALLBACK + "/other"));
    }

    @Test
    void tokenRejectsMissingTargetAfterNonDefaultTarget() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, Harness.CALLBACK + "/next"),
            Harness.CALLBACK + "/next");
        Check.refusedToken(
            harness.exchangeGet(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code, null));
    }

    @Test
    void tokenRejectsAnotherCompatibleTargetAfterDefaultTarget() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, null),
            Harness.CALLBACK);
        Check.refusedToken(
            harness.exchangeGet(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code,
                                Harness.CALLBACK + "/next"));
    }
}
