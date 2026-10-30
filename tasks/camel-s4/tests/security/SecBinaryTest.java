/*
 * Security suite: the same protection for events whose attributes and extensions travel as HTTP headers.
 */
package camelsec;

import java.util.Map;

import org.apache.camel.Exchange;
import org.apache.camel.cloudevents.CloudEvent;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

public class SecBinaryTest {

    @Test
    public void extensionHeaderWithReservedNameIsIgnored() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, String> headers = Harness.binaryHeaders("1.0");
            headers.put("ce-myextension", "myvalue");
            headers.put("ce-CamelFileName", "sender-chosen.txt");

            Exchange exchange = harness.postBinary(headers);

            assertNull(exchange.getMessage().getHeader(Exchange.FILE_NAME),
                    "a client supplied field name was applied as a framework header");
            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"),
                    "an ordinary extension must still become a message header");
            assertEquals("myEventID", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_ID));
            assertEquals("test", exchange.getMessage().getBody(String.class));
        }
    }

    @Test
    public void extensionHeaderWithUpperCaseReservedNameIsIgnored() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, String> headers = Harness.binaryHeaders("1.0");
            headers.put("ce-myextension", "myvalue");
            headers.put("ce-CAMELFILENAME", "sender-chosen.txt");

            Exchange exchange = harness.postBinary(headers);

            assertNull(exchange.getMessage().getHeader(Exchange.FILE_NAME),
                    "a client supplied field name was applied as a framework header");
            assertEquals("myvalue", exchange.getMessage().getHeader("myextension"));
        }
    }

    @Test
    public void extensionHeaderCannotOverrideAStandardAttributeHeader() throws Exception {
        try (Harness harness = new Harness("1.0")) {
            Map<String, String> headers = Harness.binaryHeaders("1.0");
            headers.put("ce-" + CloudEvent.CAMEL_CLOUD_EVENT_ID, "sender-chosen");

            Exchange exchange = harness.postBinary(headers);

            assertEquals("myEventID", exchange.getMessage().getHeader(CloudEvent.CAMEL_CLOUD_EVENT_ID),
                    "a client supplied field name replaced a framework header");
        }
    }
}
