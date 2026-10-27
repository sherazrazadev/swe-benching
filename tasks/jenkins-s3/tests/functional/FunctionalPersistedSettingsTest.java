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

/** Legitimate values of a persisted-list job property keep binding. */
@WithJenkins
public class FunctionalPersistedSettingsTest {

    @Test
    void legitimateSettingBinds(JenkinsRule j) throws Exception {
        Support.secure(j);
        FreeStyleProject job = j.createFreeStyleProject("legit-settings");

        String xml = "<hudson.model.FreeStyleProject><name>legit-settings</name><properties>"
                + "<hudson.model.ManagedSettingsProperty><settings>"
                + "<hudson.model.ManagedSetting><name>alpha</name><value>one</value></hudson.model.ManagedSetting>"
                + "<hudson.model.ManagedSetting><name>beta</name><value>two</value></hudson.model.ManagedSetting>"
                + "</settings></hudson.model.ManagedSettingsProperty>"
                + "</properties></hudson.model.FreeStyleProject>";

        int status = Support.postXml(j, "job/legit-settings/config.xml", xml);
        assertTrue(status < 300, "legitimate settings configuration was refused: " + status);

        List<JobProperty<? super FreeStyleProject>> properties = job.getAllProperties();
        assertEquals(1, properties.size());
        ManagedSettingsProperty property = (ManagedSettingsProperty) properties.get(0);
        assertEquals(2, property.settings.size());
        assertEquals("alpha", ((ManagedSetting) property.settings.get(0)).name);
        assertEquals("two", ((ManagedSetting) property.settings.get(1)).value);
    }
}
