package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.FreeStyleProject;
import hudson.model.JobProperty;
import hudson.model.ManagedSetting;
import hudson.model.ManagedSettingsProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** A job property collection backed by a persisted list obeys the same element type. */
@WithJenkins
public class SecurityPersistedSettingsTypeTest {

    @Test
    void unrelatedTypeInPersistedSettingsIsNotKept(JenkinsRule j) throws Exception {
        Support.secure(j);
        FreeStyleProject job = j.createFreeStyleProject("settings-job");

        String xml = "<hudson.model.FreeStyleProject><name>settings-job</name><properties>"
                + "<hudson.model.ManagedSettingsProperty><settings>"
                + "<hudson.model.ManagedSetting><name>kept</name><value>one</value></hudson.model.ManagedSetting>"
                + "<bench.AttackType><value>attack</value></bench.AttackType>"
                + "</settings></hudson.model.ManagedSettingsProperty>"
                + "</properties></hudson.model.FreeStyleProject>";

        int status = Support.postXml(j, "job/settings-job/config.xml", xml);
        assertTrue(status < 500, "the server failed while processing the document: " + status);

        List<JobProperty<? super FreeStyleProject>> properties = job.getAllProperties();
        if (status < 300) {
            assertEquals(1, properties.size(), "the legitimate settings property must still be applied");
            ManagedSettingsProperty property = (ManagedSettingsProperty) properties.get(0);
            assertEquals(1, property.settings.size(), "only the legitimate setting may be kept");
            assertTrue(property.settings.get(0) instanceof ManagedSetting,
                    "the legitimate setting in the same document was not applied");
        } else {
            assertEquals(0, properties.size(), "a refused document must not be applied");
        }
    }
}
