package hidden.functional;

import java.util.LinkedHashMap;

import org.springframework.data.domain.ScrollPosition;
import org.springframework.graphql.data.pagination.CursorStrategy;
import org.springframework.graphql.data.pagination.JsonCursorEncoder;
import org.springframework.graphql.data.query.ScrollPositionCursorStrategy;

import hidden.support.CursorChecks;

/**
 * Ordinary pagination whose cursor is wrapped by the product's cursor-envelope codec.
 */
public class EnvelopeCursorRoundTripTest {

    private static CursorStrategy<ScrollPosition> applicationStrategy() {
        return CursorStrategy.withEncoder(new ScrollPositionCursorStrategy(), new JsonCursorEncoder());
    }

    public void testCursorRoundTripThroughEnvelope() {
        JsonCursorEncoder encoder = new JsonCursorEncoder();
        String wrapped = encoder.encode("O_7");
        String back = encoder.decode(wrapped);
        if (!"O_7".equals(back)) {
            throw new AssertionError("envelope did not round-trip its cursor: " + back);
        }
    }

    public void testTypedKeysetValuesThroughEnvelope() {
        CursorChecks.assertTypedRoundTrip(applicationStrategy(),
                new LinkedHashMap<>(CursorChecks.typedKeys()));
    }

    public void testPaginatedQueryWithEnvelopeCursor() {
        CursorChecks.assertPaginatedQuerySucceeds(applicationStrategy(), CursorChecks.typedKeys());
    }

}
