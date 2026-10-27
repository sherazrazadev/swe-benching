package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.ListView;
import hudson.model.ViewProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/**
 * A group property whose entry collection is declared on a generic base class must still keep
 * only entries of the type the concrete group is declared to hold.
 */
@WithJenkins
public class SecurityGenericGroupTypeTest {

    @Test
    void unrelatedTypeInGroupEntriesIsNotKept(JenkinsRule j) throws Exception {
        Support.secure(j);
        ListView view = new ListView("group-view");
        j.jenkins.addView(view);

        String xml = "<hudson.model.ListView><name>group-view</name><properties>"
                + "<bench.Group><title>group</title><entries>"
                + "<bench.Entry><label>kept</label></bench.Entry>"
                + "<bench.AttackType><value>attack</value></bench.AttackType>"
                + "</entries></bench.Group>"
                + "</properties></hudson.model.ListView>";

        int status = Support.postXml(j, "view/group-view/config.xml", xml);
        assertTrue(status < 500, "the server failed while processing the document: " + status);

        List<ViewProperty> properties = view.getProperties();
        if (status < 300) {
            assertEquals(1, properties.size(), "the legitimate group property must still be applied");
            Group group = (Group) properties.get(0);
            assertEquals(1, group.entries.size(), "only the legitimate entry may be kept");
            assertTrue(group.entries.get(0) instanceof Entry,
                    "the legitimate entry in the same document was not applied");
        } else {
            assertEquals(0, properties.size(), "a refused document must not be applied");
        }
    }
}
