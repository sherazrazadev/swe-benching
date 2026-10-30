/*
 * Security suite: a client supplied field name must never become a framework internal message header.
 */
package camelsec;

import java.util.Map;

import org.apache.camel.Exchange;
import org.apache.camel.cloudevents.CloudEvent;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

public class SecStructuredTest {

    @Test
    public void reservedNameInExactCaseIsIgnored() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, Object> content = Harness.event("1.0");
            content.put("myextension", "myvalue");
            content.put("CamelFileName", "sender-chosen.txt");

            Exchange exchange = harness.postStructured(content);

            assertNull(exchange.getMessage().getHeader(Exchange.FILE_NAME),
                    "a client supplied field name was applied as a framework header");
            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"),
                    "an ordinary extension field must still become a message header");
            assertEquals("test", exchange.getMessage().getBody(String.class));
        }
    }

    @Test
    public void reservedNameInLowerCaseIsIgnored() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, Object> content = Harness.event("1.0");
            content.put("myextension", "myvalue");
            content.put("camelfilename", "sender-chosen.txt");

            Exchange exchange = harness.postStructured(content);

            assertNull(exchange.getMessage().getHeader(Exchange.FILE_NAME),
                    "a client supplied field name was applied as a framework header");
            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
        }
    }

    @Test
    public void reservedNameInUpperCaseIsIgnored() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, Object> content = Harness.event("1.0");
            content.put("myextension", "myvalue");
            content.put("CAMELFILENAME", "sender-chosen.txt");

            Exchange exchange = harness.postStructured(content);

            assertNull(exchange.getMessage().getHeader(Exchange.FILE_NAME),
                    "a client supplied field name was applied as a framework header");
            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
        }
    }

    @Test
    public void reservedNameCannotOverrideAStandardAttributeHeader() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, Object> content = Harness.event("1.0");
            content.put(CloudEvent.CAMEL_CLOUD_EVENT_ID, "sender-chosen");

            Exchange exchange = harness.postStructured(content);

            assertEquals("myEventID", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_ID),
                    "a client supplied field name replaced a framework header");
        }
    }

    @Test
    public void reservedNameIsIgnoredOnSpecVersion101() throws Exception {
        try (Harness harness = new Harness("1.0.1")) {
            Map<String, Object> content = Harness.event("1.0.1");
            content.put("myextension", "myvalue");
            content.put("CamelFileName", "sender-chosen.txt");

            Exchange exchange = harness.postStructured(content);

            assertNull(exchange.getMessage().getHeader(Exchange.FILE_NAME),
                    "a client supplied field name was applied as a framework header");
            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
        }
    }

    @Test
    public void reservedNameIsIgnoredOnSpecVersion102() throws Exception {
        try (Harness harness = new Harness("1.0.2")) {
            Map<String, Object> content = Harness.event("1.0.2");
            content.put("myextension", "myvalue");
            content.put("CamelFileName", "sender-chosen.txt");

            Exchange exchange = harness.postStructured(content);

            assertNull(exchange.getMessage().getHeader(Exchange.FILE_NAME),
                    "a client supplied field name was applied as a framework header");
            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
        }
    }
}
