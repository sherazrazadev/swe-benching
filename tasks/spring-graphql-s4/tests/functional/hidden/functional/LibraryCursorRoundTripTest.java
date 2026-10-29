package hidden.functional;

import java.util.HashMap;
import java.util.LinkedHashMap;

import org.springframework.data.domain.ScrollPosition;
import org.springframework.graphql.data.pagination.CursorEncoder;
import org.springframework.graphql.data.pagination.CursorStrategy;
import org.springframework.graphql.data.query.ScrollPositionCursorStrategy;

import hidden.support.CursorChecks;

/**
 * Ordinary keyset pagination through the library's default cursor strategy.
 */
public class LibraryCursorRoundTripTest {

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

    public void testBase64WrappedKeysetRoundTrip() {
        CursorStrategy<ScrollPosition> strategy = CursorStrategy.withEncoder(
                new ScrollPositionCursorStrategy(), CursorEncoder.base64());
        CursorChecks.assertTypedRoundTrip(strategy, new LinkedHashMap<>(CursorChecks.typedKeys()));
    }

    public void testOffsetCursorRoundTrip() {
        CursorChecks.assertOffsetRoundTrip(new ScrollPositionCursorStrategy());
    }

    public void testPaginatedQueryWithGeneratedCursor() {
        CursorChecks.assertPaginatedQuerySucceeds(
                new ScrollPositionCursorStrategy(), CursorChecks.typedKeys());
    }

}
