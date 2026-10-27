package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.ListView;
import hudson.model.ViewProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** A view's setting collection must keep only elements of its declared property type. */
@WithJenkins
public class SecurityViewPropertyTypeTest {

    @Test
    void unrelatedTypeInViewPropertiesIsNotKept(JenkinsRule j) throws Exception {
        Support.secure(j);
        ListView view = new ListView("target-view");
        j.jenkins.addView(view);

        String xml = "<hudson.model.ListView><name>target-view</name><properties>"
                + "<bench.LegitViewProperty><label>kept</label></bench.LegitViewProperty>"
                + "<bench.AttackType><value>attack</value></bench.AttackType>"
                + "</properties></hudson.model.ListView>";

        int status = Support.postXml(j, "view/target-view/config.xml", xml);
        assertTrue(status < 500, "the server failed while processing the document: " + status);

        List<ViewProperty> properties = view.getProperties();
        if (status < 300) {
            assertEquals(1, properties.size(), "only the legitimate property may be kept");
            assertTrue(properties.get(0) instanceof LegitViewProperty,
                    "the legitimate value in the same document was not applied");
        } else {
            assertEquals(0, properties.size(), "a refused document must not be applied");
        }
    }
}
