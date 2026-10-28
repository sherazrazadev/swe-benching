package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertTrue;

/**
 * The threshold-condition sub-form is embedded in the publisher form. Its fills and its validation
 * are separate endpoints, and its validation calls the TeamServer with the stored credentials.
 */
public class SecurityNestedSubformTest extends BenchBase {

    @Test
    public void thresholdRuleFillInJobContextIsNotDisclosedToReader() throws Exception {
        Page page = get("job/" + JOB + "/" + DESCRIPTOR_ROOT
                + "ThresholdCondition/fillThresholdVulnTypeItems?teamServerProfileName=" + PROFILE, READER);
        assertNotDisclosed(page, RULE_TITLE, "the vulnerability-rule list from the threshold sub-form");
    }

    @Test
    public void thresholdRuleFillAtRootIsNotDisclosedToReader() throws Exception {
        Page page = get(DESCRIPTOR_ROOT
                + "ThresholdCondition/fillThresholdVulnTypeItems?teamServerProfileName=" + PROFILE, READER);
        assertNotDisclosed(page, RULE_TITLE, "the vulnerability-rule list from the threshold sub-form");
    }

    @Test
    public void thresholdApplicationFillDoesNotContactTeamServerOrRewriteConfiguration() throws Exception {
        byte[] before = configBytes();
        teamServer.reset();

        Page page = post("job/" + JOB + "/" + DESCRIPTOR_ROOT + "ThresholdCondition/fillApplicationIdItems",
                form("teamServerProfileName", PROFILE), READER);

        assertTrue("the application fill failed with a server error (" + status(page) + ")",
                status(page) < 500);
        assertNoTeamServerContact("an unauthorised application fill");
        assertArrayEquals("an unauthorised application fill rewrote the stored profile configuration",
                before, configBytes());
    }

    @Test
    public void thresholdApplicationCheckDoesNotContactTeamServer() throws Exception {
        teamServer.reset();

        Page page = post("job/" + JOB + "/" + DESCRIPTOR_ROOT + "ThresholdCondition/checkApplicationId",
                form("teamServerProfileName", PROFILE, "value", APP_TITLE), READER);

        assertTrue("the application check failed with a server error (" + status(page) + ")",
                status(page) < 500);
        assertNoTeamServerContact("an unauthorised application check");
    }
}
