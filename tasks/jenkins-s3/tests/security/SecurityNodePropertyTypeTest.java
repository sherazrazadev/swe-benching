package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.model.Node;
import hudson.slaves.DumbSlave;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/** An agent's configuration document must keep only node properties of the declared type. */
@WithJenkins
public class SecurityNodePropertyTypeTest {

    @Test
    void unrelatedTypeInNodePropertiesIsNotKept(JenkinsRule j) throws Exception {
        Support.secure(j);
        j.createSlave("target-agent", "/tmp/remote", null);

        String document = Support.getXml(j, "computer/target-agent/config.xml");
        String attack = Support.withNodeProperties(document,
                "<bench.AttackType><value>attack</value></bench.AttackType>");

        int status = Support.postXml(j, "computer/target-agent/config.xml", attack);
        assertTrue(status < 500, "the server failed while processing the document: " + status);

        Node live = j.jenkins.getNode("target-agent");
        assertNotNull(live, "the agent configuration document was not processed");
        assertEquals(0, live.getNodeProperties().size(),
                "an element outside the declared node-property type was kept");
    }
}
