package hidden.support;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.graphql.ExecutionGraphQlRequest;
import org.springframework.graphql.ExecutionGraphQlResponse;
import org.springframework.graphql.GraphQlSetup;
import org.springframework.graphql.TestExecutionGraphQlService;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.pagination.CursorStrategy;
import org.springframework.graphql.data.query.ScrollSubrange;
import org.springframework.graphql.support.DefaultExecutionGraphQlRequest;
import org.springframework.stereotype.Controller;

/**
 * Drives a real paginated GraphQL query through the library: a schema with a paginated
 * argument set, the annotated-controller configurer that installs the subrange argument
 * resolver, and the cursor strategy under test registered as the application bean.
 */
public final class ProbeGraphQl {

    private static final String SCHEMA =
            "type Query { probe(first: Int, after: String, last: Int, before: String): String }";

    private static final String QUERY =
            "query($cursor: String) { probe(first: 2, after: $cursor) }";

    private ProbeGraphQl() {
    }

    public static ExecutionGraphQlResponse run(CursorStrategy<?> strategy, String cursor) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        try {
            context.register(ProbeController.class);
            context.registerBean(CursorStrategy.class, () -> strategy);
            context.refresh();
            TestExecutionGraphQlService service = GraphQlSetup
                    .schemaResource(new ByteArrayResource(SCHEMA.getBytes(StandardCharsets.UTF_8)))
                    .runtimeWiringForAnnotatedControllers(context)
                    .toGraphQlService();
            Map<String, Object> variables = new LinkedHashMap<>();
            variables.put("cursor", cursor);
            ExecutionGraphQlRequest request = new DefaultExecutionGraphQlRequest(
                    QUERY, null, variables, null, "probe-request", null);
            return service.execute(request).block();
        }
        finally {
            context.close();
        }
    }

    @Controller
    static class ProbeController {

        @QueryMapping
        public String probe(ScrollSubrange subrange) {
            return "ok";
        }
    }

}
