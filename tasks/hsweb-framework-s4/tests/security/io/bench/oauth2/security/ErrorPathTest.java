package io.bench.oauth2.security;

import io.bench.oauth2.Check;
import io.bench.oauth2.Harness;
import org.junit.jupiter.api.Test;

/**
 * A request that is refused must not carry the supplied address back to the caller at all: the
 * refusal path is still a response to an authorization request.
 */
class ErrorPathTest {

    @Test
    void errorPathDoesNotEchoForeignTarget() {
        Check.refusedRedirect(
            new Harness().standardClients()
                         .authorize(Harness.CLIENT_ID, "https://attacker.test/cb"),
            "attacker.test");
    }

    @Test
    void errorPathDoesNotEchoTargetForUnknownClient() {
        Check.refusedRedirect(
            new Harness().standardClients()
                         .authorize("no-such-client", "https://attacker.test/cb"),
            "attacker.test");
    }
}
