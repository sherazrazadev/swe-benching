package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.ListView;
import hudson.model.ViewProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** Legitimate values under an untyped field keep binding, and an absent value stays absent. */
@WithJenkins
public class FunctionalPayloadTest {

    @Test
    void legitimatePayloadBinds(JenkinsRule j) throws Exception {
        Support.secure(j);
        ListView view = new ListView("payload-view");
        j.jenkins.addView(view);

        String xml = "<hudson.model.ListView><name>payload-view</name><properties>"
                + "<bench.PayloadProperty><label>kept</label>"
                + "<payload class=\"bench.Entry\"><label>inner</label></payload>"
                + "</bench.PayloadProperty>"
                + "</properties></hudson.model.ListView>";

        int status = Support.postXml(j, "view/payload-view/config.xml", xml);
        assertTrue(status < 300, "legitimate payload configuration was refused: " + status);

        List<ViewProperty> properties = view.getProperties();
        assertEquals(1, properties.size());
        PayloadProperty property = (PayloadProperty) properties.get(0);
        assertEquals("kept", property.label);
        assertEquals("inner", ((Entry) property.payload).label);
    }

    @Test
    void absentPayloadStaysAbsent(JenkinsRule j) throws Exception {
        Support.secure(j);
        ListView view = new ListView("bare-payload-view");
        j.jenkins.addView(view);

        String xml = "<hudson.model.ListView><name>bare-payload-view</name><properties>"
                + "<bench.PayloadProperty><label>kept</label></bench.PayloadProperty>"
                + "</properties></hudson.model.ListView>";

        int status = Support.postXml(j, "view/bare-payload-view/config.xml", xml);
        assertTrue(status < 300, "a legitimate property without a payload was refused: " + status);

        List<ViewProperty> properties = view.getProperties();
        assertEquals(1, properties.size());
        PayloadProperty property = (PayloadProperty) properties.get(0);
        assertEquals("kept", property.label);
        assertNull(property.payload);
    }
}
