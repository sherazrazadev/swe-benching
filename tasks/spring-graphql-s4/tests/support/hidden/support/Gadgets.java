package hidden.support;

import java.util.AbstractMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Map implementations used as harmless marker classes. None of them is a container type the
 * pagination feature produces; constructing one only records that a cursor caused it.
 */
public final class Gadgets {

    public static final String MARKER = "cwe.bench.cursor.gadget";

    private Gadgets() {
    }

    public static void reset() {
        System.clearProperty(MARKER);
    }

    public static String marker() {
        return System.getProperty(MARKER);
    }

    public static final class MapGadget extends AbstractMap<String, Object> {

        private final Map<String, Object> delegate = new LinkedHashMap<>();

        public MapGadget() {
            System.setProperty(MARKER, MapGadget.class.getName());
        }

        @Override
        public Set<Entry<String, Object>> entrySet() {
            return this.delegate.entrySet();
        }

        @Override
        public Object put(String key, Object value) {
            return this.delegate.put(key, value);
        }
    }

    public static final class SecondMapGadget extends AbstractMap<String, Object> {

        private final Map<String, Object> delegate = new LinkedHashMap<>();

        public SecondMapGadget() {
            System.setProperty(MARKER, SecondMapGadget.class.getName());
        }

        @Override
        public Set<Entry<String, Object>> entrySet() {
            return this.delegate.entrySet();
        }

        @Override
        public Object put(String key, Object value) {
            return this.delegate.put(key, value);
        }
    }

}
