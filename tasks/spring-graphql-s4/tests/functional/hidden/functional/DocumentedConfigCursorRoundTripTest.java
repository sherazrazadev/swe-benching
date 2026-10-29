package hidden.functional;

import java.util.LinkedHashMap;

import org.springframework.graphql.data.pagination.CursorStrategy;
import org.springframework.graphql.docs.data.pagination.scroll.keyset.KeysetCursorConfiguration;

import hidden.support.CursorChecks;

/**
 * Ordinary keyset pagination through the application configuration the product documents.
 */
public class DocumentedConfigCursorRoundTripTest {

    private static CursorStrategy<?> applicationStrategy() {
        return new KeysetCursorConfiguration().cursorStrategy();
    }

    public void testTypedKeysetValuesRoundTrip() {
        CursorChecks.assertTypedRoundTrip(applicationStrategy(), new LinkedHashMap<>(CursorChecks.typedKeys()));
    }

    public void testUnmodifiableMapKeysetRoundTrip() {
        CursorChecks.assertTypedRoundTrip(applicationStrategy(), CursorChecks.unmodifiableKeys());
    }

    public void testPaginatedQueryWithGeneratedCursor() {
        CursorChecks.assertPaginatedQuerySucceeds(applicationStrategy(), CursorChecks.typedKeys());
    }

}
