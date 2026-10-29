package hidden.security;

import org.springframework.data.domain.ScrollPosition;
import org.springframework.graphql.ExecutionGraphQlResponse;
import org.springframework.graphql.data.pagination.CursorStrategy;
import org.springframework.graphql.data.pagination.JsonCursorEncoder;
import org.springframework.graphql.data.query.ScrollPositionCursorStrategy;

import hidden.support.Gadgets;
import hidden.support.ProbeGraphQl;

/**
 * A paginated query whose cursor is wrapped by the product's cursor-envelope codec: neither the
 * envelope itself nor a nested attribute may instantiate a class named by the client.
 */
public class EnvelopeCursorSecurityTest {

    private static CursorStrategy<ScrollPosition> applicationStrategy() {
        return CursorStrategy.withEncoder(new ScrollPositionCursorStrategy(), new JsonCursorEncoder());
    }

    public void testGadgetNamedByEnvelopeIsNotInstantiated() {
        String cursor = "[\"" + Gadgets.MapGadget.class.getName() + "\","
                + "{\"version\":2,\"cursor\":\"O_0\",\"attributes\":{}}]";
        checkRefused(cursor);
    }

    public void testGadgetNestedInEnvelopeAttributesIsNotInstantiated() {
        String cursor = "[\"java.util.LinkedHashMap\","
                + "{\"version\":2,\"cursor\":\"O_0\",\"attributes\":"
                + "[\"" + Gadgets.SecondMapGadget.class.getName() + "\",{\"x\":1}]}]";
        checkRefused(cursor);
    }

    private static void checkRefused(String cursor) {
        Gadgets.reset();
        ExecutionGraphQlResponse response = ProbeGraphQl.run(applicationStrategy(), cursor);
        String instantiated = Gadgets.marker();
        if (instantiated != null) {
            throw new AssertionError("cursor instantiated " + instantiated);
        }
        if (response == null || response.getErrors().isEmpty()) {
            throw new AssertionError("crafted cursor was accepted without an error");
        }
    }

}
