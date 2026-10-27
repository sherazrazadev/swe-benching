package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.ListView;
import hudson.model.ViewProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** Legitimate entries of the concrete entry type keep binding in a generic group property. */
@WithJenkins
public class FunctionalGenericGroupTest {

    @Test
    void legitimateGroupEntryBinds(JenkinsRule j) throws Exception {
        Support.secure(j);
        ListView view = new ListView("legit-group");
        j.jenkins.addView(view);

        String xml = "<hudson.model.ListView><name>legit-group</name><properties>"
                + "<bench.Group><title>group</title><entries>"
                + "<bench.Entry><label>kept</label></bench.Entry>"
                + "</entries></bench.Group>"
                + "</properties></hudson.model.ListView>";

        int status = Support.postXml(j, "view/legit-group/config.xml", xml);
        assertTrue(status < 300, "legitimate group configuration was refused: " + status);

        List<ViewProperty> properties = view.getProperties();
        assertEquals(1, properties.size());
        Group group = (Group) properties.get(0);
        assertEquals("group", group.title);
        assertEquals(1, group.entries.size());
        assertEquals("kept", ((Entry) group.entries.get(0)).label);
    }
}
