/*
 * Functional suite: legitimate binary CloudEvent processing must keep working.
 */
package camelsec;

import java.util.Map;

import org.apache.camel.Exchange;
import org.apache.camel.cloudevents.CloudEvent;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class FuncBinaryTest {

    @Test
    public void standardAttributesBecomeMessageHeaders() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, String> headers = Harness.binaryHeaders("1.0");

            Exchange exchange = harness.postBinary(headers);

            assertEquals("myEventID", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_ID));
            assertEquals("/somewhere", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_SOURCE));
            assertEquals("org.apache.camel.event", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_TYPE));
            assertEquals("1.0", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_VERSION));
            assertEquals("text/plain", exchange.getMessage().getHeader(Exchange.CONTENT_TYPE));
            assertEquals("test", exchange.getMessage().getBody(String.class));
        }
    }

    @Test
    public void ordinaryExtensionHeadersBecomeMessageHeaders() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, String> headers = Harness.binaryHeaders("1.0");
            headers.put("ce-myextension", "myvalue");
            headers.put("ce-Another-Ext", "othervalue");

            Exchange exchange = harness.postBinary(headers);

            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
            assertEquals("othervalue", exchange.getMessage().getHeader("another-ext"));
        }
    }

    @Test
    public void ordinaryRequestHeadersAreStillCarried() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, String> headers = Harness.binaryHeaders("1.0");
            headers.put("X-Custom-Header", "custom");
            headers.put("Authorization", "Bearer token");

            Exchange exchange = harness.postBinary(headers);

            assertEquals("custom", exchange.getMessage().getHeader("X-Custom-Header"));
            assertEquals("Bearer token", exchange.getMessage().getHeader("Authorization"));
        }
    }

    @Test
    public void binaryEventBodyIsDelivered() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Exchange exchange = harness.postBinary(Harness.binaryHeaders("1.0"));

            assertEquals("test", exchange.getMessage().getBody(String.class));
        }
    }
}
