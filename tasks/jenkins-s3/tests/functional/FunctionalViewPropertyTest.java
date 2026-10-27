package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.ListView;
import hudson.model.ViewProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** Legitimate view properties, including subtypes, keep binding. */
@WithJenkins
public class FunctionalViewPropertyTest {

    @Test
    void legitimateViewPropertyBinds(JenkinsRule j) throws Exception {
        Support.secure(j);
        ListView view = new ListView("legit-view");
        j.jenkins.addView(view);

        String xml = "<hudson.model.ListView><name>legit-view</name><properties>"
                + "<bench.LegitViewProperty><label>kept</label></bench.LegitViewProperty>"
                + "</properties></hudson.model.ListView>";

        int status = Support.postXml(j, "view/legit-view/config.xml", xml);
        assertTrue(status < 300, "legitimate view configuration was refused: " + status);

        List<ViewProperty> properties = view.getProperties();
        assertEquals(1, properties.size());
        assertEquals("kept", ((LegitViewProperty) properties.get(0)).label);
    }

    @Test
    void emptyViewPropertiesStillLoad(JenkinsRule j) throws Exception {
        Support.secure(j);
        ListView view = new ListView("empty-view");
        j.jenkins.addView(view);

        String xml = "<hudson.model.ListView><name>empty-view</name><properties/>"
                + "</hudson.model.ListView>";

        int status = Support.postXml(j, "view/empty-view/config.xml", xml);
        assertTrue(status < 300, "an empty property collection was refused: " + status);
        assertEquals(0, view.getProperties().size());
    }
}
