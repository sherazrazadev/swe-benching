/*
 * Test harness shared by the hidden suites.
 *
 * Starts one in-process platform-http server and one knative consumer route per instance, then posts
 * CloudEvents to it exactly as a client would, and exposes the message the route finally received.
 */
package camelsec;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import io.restassured.RestAssured;
import io.restassured.config.RestAssuredConfig;
import io.restassured.response.Response;
import org.apache.camel.CamelContext;
import org.apache.camel.Exchange;
import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.cloudevents.CloudEvent;
import org.apache.camel.cloudevents.CloudEvents;
import org.apache.camel.component.knative.KnativeComponent;
import org.apache.camel.component.knative.KnativeEnvironmentSupport;
import org.apache.camel.component.knative.http.KnativeHttpConsumerFactory;
import org.apache.camel.component.knative.http.KnativeHttpProducerFactory;
import org.apache.camel.component.knative.spi.Knative;
import org.apache.camel.component.knative.spi.KnativeEnvironment;
import org.apache.camel.component.knative.spi.KnativeResource;
import org.apache.camel.component.platform.http.PlatformHttpComponent;
import org.apache.camel.component.platform.http.PlatformHttpConstants;
import org.apache.camel.component.platform.http.vertx.VertxPlatformHttpEngine;
import org.apache.camel.component.platform.http.vertx.VertxPlatformHttpRouter;
import org.apache.camel.component.platform.http.vertx.VertxPlatformHttpServer;
import org.apache.camel.component.platform.http.vertx.VertxPlatformHttpServerConfiguration;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.camel.test.AvailablePortFinder;

import static io.restassured.config.EncoderConfig.encoderConfig;

public final class Harness implements AutoCloseable {

    public static final String SERVICE_NAME = "myEndpoint";
    public static final String EVENT_TYPE = "org.apache.camel.event";

    private final CamelContext context;
    private final List<Exchange> received = new CopyOnWriteArrayList<>();

    public Harness(String specVersion) throws Exception {
        this(specVersion, null);
    }

    public Harness(String specVersion, Path fileDir) throws Exception {
        final CloudEvent cloudEvent = CloudEvents.fromSpecVersion(specVersion);

        int port = AvailablePortFinder.getNextAvailable();

        this.context = new DefaultCamelContext();
        configurePlatformHttp(context, port);

        RestAssured.port = port;
        RestAssured.config = RestAssuredConfig.config()
                .encoderConfig(encoderConfig().appendDefaultContentCharsetToContentTypeIfUndefined(false));

        final KnativeResource resource = KnativeEnvironmentSupport.sourceEndpoint(
                SERVICE_NAME,
                Map.of(
                        Knative.KNATIVE_CLOUD_EVENT_TYPE, EVENT_TYPE,
                        Knative.CONTENT_TYPE, "text/plain"));

        KnativeComponent component = context.getComponent("knative", KnativeComponent.class);
        component.setCloudEventsSpecVersion(cloudEvent.version());
        component.setEnvironment(new KnativeEnvironment(List.of(resource)));
        component.setConsumerFactory(new KnativeHttpConsumerFactory(context) {
            @Override
            protected void doBuild() throws Exception {
                super.doBuild();
                this.setRouter(VertxPlatformHttpRouter.lookup(context,
                        VertxPlatformHttpRouter.getRouterNameFromPort(RestAssured.port)));
            }
        });
        component.setProducerFactory(new KnativeHttpProducerFactory(context) {
            @Override
            protected void doBuild() throws Exception {
                super.doBuild();
                this.setVertx(VertxPlatformHttpRouter
                        .lookup(context, VertxPlatformHttpRouter.getRouterNameFromPort(RestAssured.port)).vertx());
            }
        });

        RouteBuilder.addRoutes(context, b -> {
            var route = b.from("knative:endpoint/" + SERVICE_NAME).process(this::record);
            if (fileDir != null) {
                route.to("file:" + fileDir.toAbsolutePath());
            }
        });

        context.start();
    }

    private void record(Exchange exchange) {
        // keep the message as the route saw it; the reply path may remove CloudEvent headers afterwards
        received.add(exchange.copy());
    }

    /** A minimal structured CloudEvent body; callers add their own fields. */
    public static Map<String, Object> event(String specVersion) {
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("specversion", specVersion);
        content.put("type", EVENT_TYPE);
        content.put("id", "myEventID");
        content.put("source", "/somewhere");
        content.put("datacontenttype", "text/plain");
        content.put("data", "test");
        return content;
    }

    /** Post a structured CloudEvent (one JSON object as the whole body). */
    public Exchange postStructured(Map<String, Object> content) {
        Response response = RestAssured.given()
                .contentType(Knative.MIME_STRUCTURED_CONTENT_MODE)
                .body(content)
                .when()
                .post();
        return await(response.statusCode());
    }

    /** Post a binary CloudEvent (attributes and extensions in HTTP headers, data in the body). */
    public Exchange postBinary(Map<String, String> headers) {
        var request = RestAssured.given()
                .body("test")
                .header(Exchange.CONTENT_TYPE, "text/plain");
        headers.forEach(request::header);

        Response response = request.when().post();
        return await(response.statusCode());
    }

    /** Standard binary-mode attribute headers for the given spec version. */
    public static Map<String, String> binaryHeaders(String specVersion) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("ce-specversion", specVersion);
        headers.put("ce-type", EVENT_TYPE);
        headers.put("ce-id", "myEventID");
        headers.put("ce-source", "/somewhere");
        headers.put("ce-datacontenttype", "text/plain");
        return headers;
    }

    private Exchange await(int statusCode) {
        if (statusCode < 200 || statusCode >= 300) {
            throw new AssertionError("the event was not accepted by the application (HTTP " + statusCode + ")");
        }

        long deadline = System.currentTimeMillis() + 5000;
        while (received.isEmpty() && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(20);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        if (received.isEmpty()) {
            throw new AssertionError("the event was not delivered to the route");
        }
        return received.get(0);
    }

    @Override
    public void close() {
        try {
            context.stop();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public static void configurePlatformHttp(CamelContext camelContext, int bindPort) {
        VertxPlatformHttpServerConfiguration configuration = new VertxPlatformHttpServerConfiguration();
        configuration.setBindPort(bindPort);

        try {
            camelContext.addService(new TestPlatformHttpServer(configuration));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        PlatformHttpComponent component = new PlatformHttpComponent(camelContext);
        component.setEngine(new VertxPlatformHttpEngine());

        camelContext.getRegistry().bind(PlatformHttpConstants.PLATFORM_HTTP_COMPONENT_NAME, component);
    }

    public static final class TestPlatformHttpServer extends VertxPlatformHttpServer {

        public TestPlatformHttpServer(VertxPlatformHttpServerConfiguration configuration) {
            super(configuration);
        }

        @Override
        protected void doInit() throws Exception {
            super.initializeServer();
        }

        @Override
        protected void doStart() throws Exception {
            super.startServer();
        }
    }
}
