package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

import static org.junit.Assert.assertTrue;

/** The pipeline-step validation looks up the application on the TeamServer. */
public class SecurityInjectedStepCheckTest extends BenchBase {

    @Test
    public void pipelineStepApplicationCheckDoesNotContactTeamServerForReader() throws Exception {
        teamServer.reset();

        Page page = post("job/" + JOB + "/" + DESCRIPTOR_ROOT + "VulnerabilityTrendStep/checkApplicationId",
                form("profile", PROFILE, "value", APP_TITLE), READER);

        assertTrue("the application check failed with a server error (" + status(page) + ")",
                status(page) < 500);
        assertNoTeamServerContact("an unauthorised pipeline-step application check");
    }
}
