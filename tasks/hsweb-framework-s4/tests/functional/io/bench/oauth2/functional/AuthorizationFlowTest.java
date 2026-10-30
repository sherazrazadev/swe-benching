package io.bench.oauth2.functional;

import io.bench.oauth2.Check;
import io.bench.oauth2.Harness;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Legitimate authorization requests that work today and must keep working. */
class AuthorizationFlowTest {

    private Harness harness() {
        return new Harness().standardClients();
    }

    @Test
    void exactCallbackIsAccepted() {
        Check.issuedRedirect(harness().authorize(Harness.CLIENT_ID, Harness.CALLBACK),
                             Harness.CALLBACK);
    }

    @Test
    void extraQueryParametersAreAccepted() {
        String target = Harness.CALLBACK + "?a=1&n=1";
        Check.issuedRedirect(harness().authorize(Harness.CLIENT_ID, target), target);
    }

    @Test
    void deeperPathIsAccepted() {
        String target = Harness.CALLBACK + "/next";
        Check.issuedRedirect(harness().authorize(Harness.CLIENT_ID, target), target);
    }

    @Test
    void subPathOfRegisteredOriginIsAccepted() {
        String target = Harness.ORIGIN + "/cb";
        Check.issuedRedirect(harness().authorize(Harness.ORIGIN_CLIENT_ID, target), target);
    }

    @Test
    void registeredDefaultIsUsedWhenTargetIsAbsent() {
        Check.issuedRedirect(harness().authorize(Harness.CLIENT_ID, null), Harness.CALLBACK);
    }

    @Test
    void stateIsEchoedToTheCallback() {
        Harness.Result result = harness().authorize(Harness.CLIENT_ID, Harness.CALLBACK, "round-trip");
        Check.issuedRedirect(result, Harness.CALLBACK);
        assertTrue(result.body.contains("state=round-trip"),
                   "the state was not echoed: " + result);
    }

    @Test
    void unknownClientIsRefusedCleanly() {
        Check.clientError(harness().authorize("no-such-client", null));
    }
}
