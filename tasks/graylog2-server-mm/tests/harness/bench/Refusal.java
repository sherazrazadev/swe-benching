package bench;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.assertj.core.api.Assertions;
import org.assertj.core.api.ThrowableAssert;

/** Asserts the refusal form the report promises: a client error, never a success. */
public final class Refusal {
    private Refusal() {
    }

    public static void assertClientError(ThrowableAssert.ThrowingCallable call) {
        try {
            call.call();
        } catch (Throwable thrown) {
            if (thrown instanceof WebApplicationException web) {
                assertClientError(web.getResponse());
                return;
            }
            Assertions.fail("a refusal must be a client error, got " + thrown);
        }
        Assertions.fail("the request was accepted but must be refused");
    }

    public static void assertClientError(Response response) {
        final int status = response.getStatus();
        Assertions.assertThat(status)
                .as("a refusal must be a client error, got HTTP %s", status)
                .isBetween(400, 499);
    }
}
