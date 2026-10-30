package io.bench.oauth2.security;

import io.bench.oauth2.Check;
import io.bench.oauth2.Harness;
import org.junit.jupiter.api.Test;

/**
 * Targets that are only a string prefix of the registered callback, or that cannot be parsed as
 * the registered callback at all, must not receive the authorization result.
 */
class AuthorizationTargetTest {

    private Harness harness() {
        return new Harness().standardClients();
    }

    @Test
    void rejectsLookalikeHost() {
        Check.refusedRedirect(
            harness().authorize(Harness.ORIGIN_CLIENT_ID,
                                "https://trusted.example.com.attacker.test/cb"),
            "attacker.test");
    }

    @Test
    void rejectsUserInfoAuthority() {
        Check.refusedRedirect(
            harness().authorize(Harness.ORIGIN_CLIENT_ID,
                                "https://trusted.example.com@attacker.test/cb"),
            "attacker.test");
    }

    @Test
    void rejectsSiblingPath() {
        Check.refusedRedirect(
            harness().authorize(Harness.CLIENT_ID, Harness.CALLBACK + "2"),
            Harness.CALLBACK + "2");
    }

    @Test
    void rejectsPathLookalike() {
        Check.refusedRedirect(
            harness().authorize(Harness.CLIENT_ID, Harness.CALLBACK + ".attacker.test/cb"),
            "attacker.test");
    }

    @Test
    void rejectsFragmentTarget() {
        Check.refusedRedirect(
            harness().authorize(Harness.CLIENT_ID, Harness.CALLBACK + "#frag"),
            "#frag");
    }

    @Test
    void rejectsForeignPort() {
        Check.refusedRedirect(
            harness().authorize(Harness.ORIGIN_CLIENT_ID,
                                "https://trusted.example.com:8443/cb"),
            ":8443");
    }

    @Test
    void rejectsUnparseableTarget() {
        Check.refusedRedirect(
            harness().authorize(Harness.ORIGIN_CLIENT_ID,
                                "https://trusted.example.com/with space"));
    }
}
