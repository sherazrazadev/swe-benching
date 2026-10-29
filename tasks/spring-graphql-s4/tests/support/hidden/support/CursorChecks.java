package hidden.support;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import org.springframework.data.domain.KeysetScrollPosition;
import org.springframework.data.domain.OffsetScrollPosition;
import org.springframework.data.domain.ScrollPosition;
import org.springframework.graphql.ExecutionGraphQlResponse;
import org.springframework.graphql.data.pagination.CursorStrategy;

/**
 * Round-trip checks for ordinary keyset positions. The value types here are the ones the feature
 * itself produces and consumes; they must keep working whatever a fix does to refuse other types.
 */
public final class CursorChecks {

    private CursorChecks() {
    }

    public static Map<String, Object> typedKeys() {
        Map<String, Object> keys = new LinkedHashMap<>();
        keys.put("id", 7);
        keys.put("date", new Date(1234567890L));
        Calendar calendar = new GregorianCalendar(TimeZone.getTimeZone("UTC"));
        calendar.setTimeInMillis(1234567890L);
        keys.put("calendar", calendar);
        keys.put("uuid", UUID.fromString("00000000-0000-0000-0000-000000000001"));
        keys.put("amount", new BigDecimal("12.50"));
        keys.put("instant", Instant.ofEpochSecond(1234567890L));
        keys.put("localDate", LocalDate.of(2026, 1, 2));
        keys.put("unit", TimeUnit.SECONDS);
        return keys;
    }

    public static Map<String, Object> unmodifiableKeys() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(typedKeys()));
    }

    public static void assertTypedRoundTrip(CursorStrategy<?> strategy, Map<String, Object> keys) {
        ScrollPosition back = fromCursor(strategy, toCursor(strategy, ScrollPosition.forward(keys)));
        if (!(back instanceof KeysetScrollPosition position)) {
            throw new AssertionError("expected a keyset position, got " + back);
        }
        Map<String, Object> decoded = position.getKeys();
        expectEqual(decoded, "id", Integer.valueOf(7));
        expectEqual(decoded, "uuid", keys.get("uuid"));
        expectEqual(decoded, "instant", keys.get("instant"));
        expectEqual(decoded, "localDate", keys.get("localDate"));
        expectEqual(decoded, "unit", keys.get("unit"));
        Object date = decoded.get("date");
        if (!(date instanceof Date) || ((Date) date).getTime() != 1234567890L) {
            throw new AssertionError("date value lost: " + describe(date));
        }
        Object calendar = decoded.get("calendar");
        if (!(calendar instanceof Calendar) || ((Calendar) calendar).getTimeInMillis() != 1234567890L) {
            throw new AssertionError("calendar value lost: " + describe(calendar));
        }
        Object amount = decoded.get("amount");
        if (!(amount instanceof BigDecimal) || ((BigDecimal) amount).compareTo(new BigDecimal("12.50")) != 0) {
            throw new AssertionError("number value lost: " + describe(amount));
        }
    }

    public static void assertOffsetRoundTrip(CursorStrategy<?> strategy) {
        String cursor = toCursor(strategy, ScrollPosition.offset(43));
        if (!"O_43".equals(cursor)) {
            throw new AssertionError("offset cursor changed: " + cursor);
        }
        ScrollPosition back = fromCursor(strategy, cursor);
        if (!(back instanceof OffsetScrollPosition offset) || offset.getOffset() != 43) {
            throw new AssertionError("offset cursor did not round-trip: " + back);
        }
    }

    public static void assertPaginatedQuerySucceeds(CursorStrategy<?> strategy, Map<String, Object> keys) {
        String cursor = toCursor(strategy, ScrollPosition.forward(keys));
        ExecutionGraphQlResponse response = ProbeGraphQl.run(strategy, cursor);
        if (response == null) {
            throw new AssertionError("no response");
        }
        if (!response.getErrors().isEmpty()) {
            throw new AssertionError("ordinary cursor refused: " + response.getErrors());
        }
        Object data = response.getData();
        if (data == null) {
            throw new AssertionError("no data for ordinary cursor");
        }
    }

    @SuppressWarnings("unchecked")
    private static String toCursor(CursorStrategy<?> strategy, ScrollPosition position) {
        try {
            return ((CursorStrategy<ScrollPosition>) strategy).toCursor(position);
        }
        catch (RuntimeException ex) {
            throw new AssertionError("could not encode an ordinary position: " + ex);
        }
    }

    @SuppressWarnings("unchecked")
    private static ScrollPosition fromCursor(CursorStrategy<?> strategy, String cursor) {
        try {
            return ((CursorStrategy<ScrollPosition>) strategy).fromCursor(cursor);
        }
        catch (RuntimeException ex) {
            throw new AssertionError("could not decode an ordinary cursor: " + ex);
        }
    }

    private static void expectEqual(Map<String, Object> decoded, String key, Object expected) {
        Object actual = decoded.get(key);
        if (actual == null || !actual.equals(expected)) {
            throw new AssertionError(key + " value lost: expected " + expected + " but was " + describe(actual));
        }
    }

    private static String describe(Object value) {
        return (value == null) ? "null" : value.getClass().getName() + "[" + value + "]";
    }

}
