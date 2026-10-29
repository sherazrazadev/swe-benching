package hidden.security;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.springframework.graphql.ExecutionGraphQlResponse;
import org.springframework.graphql.data.pagination.CursorStrategy;
import org.springframework.graphql.docs.data.pagination.scroll.keyset.KeysetCursorConfiguration;

import hidden.support.Gadgets;
import hidden.support.ProbeGraphQl;

/**
 * A paginated query served by an application configured through the product's own documented
 * keyset-cursor customization: a client cursor that names a class must not instantiate it.
 */
public class DocumentedConfigCursorSecurityTest {

    private static CursorStrategy<?> applicationStrategy() {
        return new KeysetCursorConfiguration().cursorStrategy();
    }

    public void testGadgetNamedByCursorIsNotInstantiated() {
        checkRefused(cursor(Gadgets.MapGadget.class.getName()));
    }

    public void testSecondGadgetNamedByCursorIsNotInstantiated() {
        checkRefused(cursor(Gadgets.SecondMapGadget.class.getName()));
    }

    private static String cursor(String className) {
        String keyset = "K_[\"" + className + "\",{\"id\":1}]";
        return Base64.getEncoder().encodeToString(keyset.getBytes(StandardCharsets.UTF_8));
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
