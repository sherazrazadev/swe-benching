package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

/**
 * The agent-download step can show the selected profile's connection details.
 */
public class SecurityInjectedConnectionMetadataTest extends BenchBase {

    @Test
    public void agentStepConnectionDetailFillIsNotDisclosedToReader() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "ContrastAgentStep/fillTeamServerConnectionItems?profile="
                + PROFILE, READER);
        assertNotDisclosed(page, ORG, "the connection details from the agent step");
        assertNotDisclosed(page, teamServer.apiUrl(), "the TeamServer address from the agent step");
    }
}
