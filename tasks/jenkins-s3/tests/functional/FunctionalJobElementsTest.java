package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.FreeStyleProject;
import hudson.model.JobProperty;
import hudson.model.ParametersDefinitionProperty;
import hudson.tasks.Builder;
import hudson.tasks.Shell;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** Legitimate job elements keep binding, including plugin-provided and legacy shapes. */
@WithJenkins
public class FunctionalJobElementsTest {

    @Test
    void legitimateJobElementsBind(JenkinsRule j) throws Exception {
        Support.secure(j);
        FreeStyleProject job = j.createFreeStyleProject("legit-job");

        String xml = "<hudson.model.FreeStyleProject><name>legit-job</name>"
                + "<builders>"
                + "<hudson.tasks.Shell><command>echo kept</command></hudson.tasks.Shell>"
                + "</builders>"
                + "<properties>"
                + "<bench.LegitJobProperty><label>custom</label></bench.LegitJobProperty>"
                + "<hudson.model.ParametersDefinitionProperty><parameterDefinitions/></hudson.model.ParametersDefinitionProperty>"
                + "</properties>"
                + "</hudson.model.FreeStyleProject>";

        int status = Support.postXml(j, "job/legit-job/config.xml", xml);
        assertTrue(status < 300, "legitimate job configuration was refused: " + status);

        List<Builder> builders = job.getBuildersList();
        assertEquals(1, builders.size());
        assertEquals("echo kept", ((Shell) builders.get(0)).getCommand());

        List<JobProperty<? super FreeStyleProject>> properties = job.getAllProperties();
        assertEquals(2, properties.size(), "legitimate job properties were not both applied");
        assertNotNull(job.getProperty(ParametersDefinitionProperty.class));
        assertTrue(properties.stream().anyMatch(p -> p instanceof LegitJobProperty));
    }

    @Test
    void jobWithoutCollectionsStillLoads(JenkinsRule j) throws Exception {
        Support.secure(j);
        FreeStyleProject job = j.createFreeStyleProject("bare-job");

        String xml = "<hudson.model.FreeStyleProject><name>bare-job</name></hudson.model.FreeStyleProject>";
        int status = Support.postXml(j, "job/bare-job/config.xml", xml);
        assertTrue(status < 300, "a job document without collections was refused: " + status);
        assertEquals(0, job.getBuildersList().size());
        assertEquals(0, job.getAllProperties().size());
    }
}
