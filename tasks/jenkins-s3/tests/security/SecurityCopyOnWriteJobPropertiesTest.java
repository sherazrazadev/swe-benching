package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.FreeStyleProject;
import hudson.model.JobProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** A job property collection backed by a copy-on-write list obeys the same element type. */
@WithJenkins
public class SecurityCopyOnWriteJobPropertiesTest {

    @Test
    void unrelatedTypeInJobPropertiesIsNotKept(JenkinsRule j) throws Exception {
        Support.secure(j);
        FreeStyleProject job = j.createFreeStyleProject("property-job");

        String xml = "<hudson.model.FreeStyleProject><name>property-job</name><properties>"
                + "<bench.LegitJobProperty><label>kept</label></bench.LegitJobProperty>"
                + "<bench.AttackType><value>attack</value></bench.AttackType>"
                + "</properties></hudson.model.FreeStyleProject>";

        int status = Support.postXml(j, "job/property-job/config.xml", xml);
        assertTrue(status < 500, "the server failed while processing the document: " + status);

        List<JobProperty<? super FreeStyleProject>> properties = job.getAllProperties();
        if (status < 300) {
            assertEquals(1, properties.size(), "only the legitimate job property may be kept");
            assertTrue(properties.get(0) instanceof LegitJobProperty,
                    "the legitimate value in the same document was not applied");
        } else {
            assertEquals(0, properties.size(), "a refused document must not be applied");
        }
    }
}
