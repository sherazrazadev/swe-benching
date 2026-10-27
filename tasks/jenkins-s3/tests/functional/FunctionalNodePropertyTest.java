package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.Node;
import hudson.slaves.NodeProperty;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** Legitimate node properties keep binding through an agent's configuration document. */
@WithJenkins
public class FunctionalNodePropertyTest {

    @Test
    void legitimateNodePropertyBinds(JenkinsRule j) throws Exception {
        Support.secure(j);
        j.createSlave("legit-agent", "/tmp/remote", null);

        String document = Support.getXml(j, "computer/legit-agent/config.xml");
        String updated = Support.withNodeProperties(document,
                "<bench.LegitNodeProperty><label>kept</label></bench.LegitNodeProperty>");

        int status = Support.postXml(j, "computer/legit-agent/config.xml", updated);
        assertTrue(status < 300, "legitimate agent configuration was refused: " + status);

        Node live = j.jenkins.getNode("legit-agent");
        assertNotNull(live);
        assertEquals(1, live.getNodeProperties().size());
        NodeProperty<?> property = live.getNodeProperties().get(0);
        assertEquals("kept", ((LegitNodeProperty) property).label);
    }
}
