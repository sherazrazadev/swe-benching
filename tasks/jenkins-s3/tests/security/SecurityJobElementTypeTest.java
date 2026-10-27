package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.FreeStyleProject;
import hudson.tasks.Builder;
import hudson.tasks.Shell;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** A job's element collections must keep only elements of their declared element type. */
@WithJenkins
public class SecurityJobElementTypeTest {

    @Test
    void unrelatedTypeInJobBuildersIsNotKept(JenkinsRule j) throws Exception {
        Support.secure(j);
        FreeStyleProject job = j.createFreeStyleProject("target-job");

        String xml = "<hudson.model.FreeStyleProject><name>target-job</name><builders>"
                + "<hudson.tasks.Shell><command>echo kept</command></hudson.tasks.Shell>"
                + "<bench.AttackType><value>attack</value></bench.AttackType>"
                + "</builders></hudson.model.FreeStyleProject>";

        int status = Support.postXml(j, "job/target-job/config.xml", xml);
        assertTrue(status < 500, "the server failed while processing the document: " + status);

        List<Builder> builders = job.getBuildersList();
        if (status < 300) {
            assertEquals(1, builders.size(), "only the legitimate builder may be kept");
            assertTrue(builders.get(0) instanceof Shell,
                    "the legitimate value in the same document was not applied");
        } else {
            assertEquals(0, builders.size(), "a refused document must not be applied");
        }
    }

    @Test
    void unrelatedTypeSelectedByClassAttributeIsNotKept(JenkinsRule j) throws Exception {
        Support.secure(j);
        FreeStyleProject job = j.createFreeStyleProject("class-attribute-job");

        String xml = "<hudson.model.FreeStyleProject><name>class-attribute-job</name><builders>"
                + "<entry class=\"bench.AttackType\"><value>attack</value></entry>"
                + "</builders></hudson.model.FreeStyleProject>";

        int status = Support.postXml(j, "job/class-attribute-job/config.xml", xml);
        assertTrue(status < 500, "the server failed while processing the document: " + status);

        List<Builder> builders = job.getBuildersList();
        assertEquals(0, builders.size(), "an element selected by its class attribute was kept");
    }
}
