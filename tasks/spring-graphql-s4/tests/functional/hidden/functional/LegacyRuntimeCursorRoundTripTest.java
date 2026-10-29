package hidden.functional;

import java.util.HashMap;

import org.springframework.graphql.data.query.ScrollPositionCursorStrategy;

import hidden.support.CursorChecks;

/**
 * Ordinary keyset pagination on the product's compatibility JSON stack (the newer JSON library
 * is not on the classpath).
 */
public class LegacyRuntimeCursorRoundTripTest {

    public void testTypedKeysetValuesRoundTrip() {
        CursorChecks.assertTypedRoundTrip(new ScrollPositionCursorStrategy(), CursorChecks.typedKeys());
    }

    public void testHashMapKeysetRoundTrip() {
        CursorChecks.assertTypedRoundTrip(new ScrollPositionCursorStrategy(),
                new HashMap<>(CursorChecks.typedKeys()));
    }

    public void testUnmodifiableMapKeysetRoundTrip() {
        CursorChecks.assertTypedRoundTrip(new ScrollPositionCursorStrategy(), CursorChecks.unmodifiableKeys());
    }

    public void testPaginatedQueryWithGeneratedCursor() {
        CursorChecks.assertPaginatedQuerySucceeds(
                new ScrollPositionCursorStrategy(), CursorChecks.typedKeys());
    }

}
