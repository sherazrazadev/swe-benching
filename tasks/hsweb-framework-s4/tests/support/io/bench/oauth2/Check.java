package io.bench.oauth2;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Assertions on raw HTTP results; no expected value comes from product helpers. */
public final class Check {

    private Check() {
    }

    /**
     * A refused authorization request: a client error, no authorization code and no address of the
     * target that was supplied.
     */
    public static void refusedRedirect(Harness.Result result, String... forbidden) {
        assertTrue(result.isClientError(),
                   "expected a client error, got " + result);
        assertFalse(result.body.contains("code="),
                    "an authorization code was returned: " + result);
        for (String value : forbidden) {
            assertFalse(result.body.contains(value),
                        "the response carries the supplied target (" + value + "): " + result);
        }
    }

    /** A refused code redemption: a client error and no access token. */
    public static void refusedToken(Harness.Result result) {
        assertTrue(result.isClientError(),
                   "expected a client error, got " + result);
        assertFalse(result.body.contains("access_token"),
                    "an access token was issued: " + result);
    }

    /** An issued authorization response that points at the expected callback and carries a code. */
    public static String issuedRedirect(Harness.Result result, String expectedPrefix) {
        assertTrue(result.isSuccess(), "expected the request to succeed, got " + result);
        assertTrue(result.body.startsWith(expectedPrefix),
                   "expected a redirect target starting with " + expectedPrefix + ", got " + result);
        String code = Harness.codeFrom(result.body);
        assertNotNull(code, "no authorization code in " + result);
        return code;
    }

    /** An issued access token. */
    public static void issuedToken(Harness.Result result) {
        assertTrue(result.isSuccess(), "expected the redemption to succeed, got " + result);
        assertTrue(result.body.contains("access_token"),
                   "no access token in " + result);
    }

    /** A clean client error with no token. */
    public static void clientError(Harness.Result result) {
        assertTrue(result.isClientError(), "expected a client error, got " + result);
    }
}
