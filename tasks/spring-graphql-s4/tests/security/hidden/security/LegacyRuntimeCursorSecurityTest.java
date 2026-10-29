package hidden.security;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.springframework.data.domain.ScrollPosition;
import org.springframework.graphql.ExecutionGraphQlResponse;
import org.springframework.graphql.data.pagination.CursorEncoder;
import org.springframework.graphql.data.pagination.CursorStrategy;
import org.springframework.graphql.data.query.ScrollPositionCursorStrategy;

import hidden.support.Gadgets;
import hidden.support.ProbeGraphQl;

/**
 * A paginated query served by an application on the product's compatibility JSON stack (the
 * newer JSON library is not on the classpath): a client cursor that names a class must not
 * instantiate it, whether the cursor is passed through directly or wrapped by the Base 64
 * cursor encoder the auto-registered data fetchers use.
 */
public class LegacyRuntimeCursorSecurityTest {

    public void testGadgetNamedByKeysetCursorIsNotInstantiated() {
        checkRefused(new ScrollPositionCursorStrategy(), cursor(Gadgets.MapGadget.class.getName()));
    }

    public void testGadgetNamedByBase64CursorIsNotInstantiated() {
        CursorStrategy<ScrollPosition> strategy =
                CursorStrategy.withEncoder(new ScrollPositionCursorStrategy(), CursorEncoder.base64());
        String wrapped = Base64.getEncoder().encodeToString(
                cursor(Gadgets.SecondMapGadget.class.getName()).getBytes(StandardCharsets.UTF_8));
        checkRefused(strategy, wrapped);
    }

    private static String cursor(String className) {
        return "K_[\"" + className + "\",{\"id\":1}]";
    }

    private static void checkRefused(CursorStrategy<?> strategy, String cursor) {
        Gadgets.reset();
        ExecutionGraphQlResponse response = ProbeGraphQl.run(strategy, cursor);
        String instantiated = Gadgets.marker();
        if (instantiated != null) {
            throw new AssertionError("cursor instantiated " + instantiated);
        }
        if (response == null || response.getErrors().isEmpty()) {
            throw new AssertionError("crafted cursor was accepted without an error");
        }
    }

}
