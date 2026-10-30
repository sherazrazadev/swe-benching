package io.bench.oauth2.functional;

import io.bench.oauth2.Check;
import io.bench.oauth2.Harness;
import org.junit.jupiter.api.Test;

/** Legitimate code redemptions that work today and must keep working. */
class TokenExchangeTest {

    private Harness harness() {
        return new Harness().standardClients();
    }

    @Test
    void redemptionWithSameTargetSucceedsOnGet() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, Harness.CALLBACK + "/next"),
            Harness.CALLBACK + "/next");
        Check.issuedToken(
            harness.exchangeGet(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code,
                                Harness.CALLBACK + "/next"));
    }

    @Test
    void redemptionWithSameTargetSucceedsOnPost() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, Harness.CALLBACK + "/next"),
            Harness.CALLBACK + "/next");
        Check.issuedToken(
            harness.exchangePost(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code,
                                 Harness.CALLBACK + "/next"));
    }

    @Test
    void redemptionWithExactTargetSucceeds() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, Harness.CALLBACK),
            Harness.CALLBACK);
        Check.issuedToken(
            harness.exchangeGet(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code, Harness.CALLBACK));
    }

    @Test
    void redemptionWithRegisteredDefaultSucceeds() {
        Harness harness = harness();
        String code = Check.issuedRedirect(
            harness.authorize(Harness.CLIENT_ID, null),
            Harness.CALLBACK);
        Check.issuedToken(
            harness.exchangeGet(Harness.CLIENT_ID, Harness.CLIENT_SECRET, code, null));
    }
}
