/*
 * Functional suite: legitimate structured CloudEvent processing must keep working.
 */
package camelsec;

import java.util.List;
import java.util.Map;

import org.apache.camel.Exchange;
import org.apache.camel.cloudevents.CloudEvent;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

public class FuncStructuredTest {

    @Test
    public void standardAttributesBecomeMessageHeaders() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, Object> content = Harness.event("1.0");
            content.put("subject", "a-subject");
            content.put("dataschema", "https://example.test/schema");
            content.put("time", "2026-01-02T03:04:05Z");

            Exchange exchange = harness.postStructured(content);

            assertEquals("myEventID", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_ID));
            assertEquals("/somewhere", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_SOURCE));
            assertEquals("org.apache.camel.event", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_TYPE));
            assertEquals("1.0", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_VERSION));
            assertEquals("a-subject", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_SUBJECT));
            assertEquals("https://example.test/schema",
                    exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_SCHEMA_URL));
            assertEquals("2026-01-02T03:04:05Z", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_TIME));
            assertEquals("text/plain", exchange.getMessage().getHeader(Exchange.CONTENT_TYPE));
            assertEquals("test", exchange.getMessage().getBody(String.class));
        }
    }

    @Test
    public void ordinaryExtensionFieldsBecomeMessageHeaders() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, Object> content = Harness.event("1.0");
            content.put("myextension", "myvalue");
            content.put("countext", 42);
            content.put("objext", Map.of("nested", "value"));
            content.put("arrext", List.of("one", "two"));

            Exchange exchange = harness.postStructured(content);

            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
            assertEquals(42, exchange.getMessage().getHeader("countext"));
            assertNotNull(exchange.getMessage().getHeader("objext"));
            assertNotNull(exchange.getMessage().getHeader("arrext"));
        }
    }

    @Test
    public void ordinaryExtensionFieldsBecomeMessageHeadersOnSpecVersion101() throws Exception {
        try (Harness harness = new Harness("1.0.1")) {
            Map<String, Object> content = Harness.event("1.0.1");
            content.put("myextension", "myvalue");

            Exchange exchange = harness.postStructured(content);

            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
            assertEquals("1.0.1", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_VERSION));
        }
    }

    @Test
    public void ordinaryExtensionFieldsBecomeMessageHeadersOnSpecVersion102() throws Exception {
        try (Harness harness = new Harness("1.0.2")) {
            Map<String, Object> content = Harness.event("1.0.2");
            content.put("myextension", "myvalue");

            Exchange exchange = harness.postStructured(content);

            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
            assertEquals("1.0.2", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_VERSION));
        }
    }
}
