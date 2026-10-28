package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

import static org.junit.Assert.assertTrue;

/** An administrator keeps every choice the plugin offers on the controller-wide page. */
public class FunctionalAdminTest extends BenchBase {

    @Test
    public void administratorGetsPublisherProfileChoicesAtRoot() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "VulnerabilityTrendRecorder/fillTeamServerProfileNameItems", ADMIN);
        assertContains(page, PROFILE, "the publisher profile fill for an administrator");
    }

    @Test
    public void administratorGetsGlobalConfigurationChoicesAtRoot() throws Exception {
        assertContains(get(DESCRIPTOR_ROOT + "ContrastPluginConfig/fillTeamServerProfileNameItems", ADMIN),
                PROFILE, "the global profile fill for an administrator");
        assertContains(get(DESCRIPTOR_ROOT + "ContrastPluginConfig/fillThresholdVulnTypeItems?teamServerProfileName="
                + PROFILE, ADMIN), RULE_TITLE, "the global rule fill for an administrator");
    }

    @Test
    public void administratorGetsPipelineStepChoicesAtRoot() throws Exception {
        assertContains(get(DESCRIPTOR_ROOT + "VulnerabilityTrendStep/fillProfileItems", ADMIN),
                PROFILE, "the pipeline-step profile fill for an administrator");
        assertContains(get(DESCRIPTOR_ROOT + "VulnerabilityTrendStep/fillApplicationIdItems?profile=" + PROFILE,
                ADMIN), APP_TITLE, "the pipeline-step application fill for an administrator");
        assertContains(get(DESCRIPTOR_ROOT + "VulnerabilityTrendStep/fillRuleItems?profile=" + PROFILE, ADMIN),
                RULE_TITLE, "the pipeline-step rule fill for an administrator");
    }

    @Test
    public void administratorGetsAgentStepChoicesAtRoot() throws Exception {
        assertContains(get(DESCRIPTOR_ROOT + "ContrastAgentStep/fillProfileItems", ADMIN),
                PROFILE, "the agent-step profile fill for an administrator");
    }

    @Test
    public void administratorGetsInjectedThresholdChoices() throws Exception {
        assertContains(get(DESCRIPTOR_ROOT + "GlobalThresholdCondition/fillTeamServerProfileNameItems", ADMIN),
                PROFILE, "the global threshold profile fill for an administrator");
        assertContains(get(DESCRIPTOR_ROOT
                        + "GlobalThresholdCondition/fillThresholdVulnTypeItems?teamServerProfileName=" + PROFILE,
                ADMIN), RULE_TITLE, "the global threshold rule fill for an administrator");
    }

    @Test
    public void administratorGetsInjectedConnectionDetails() throws Exception {
        assertContains(get(DESCRIPTOR_ROOT + "ContrastAgentStep/fillTeamServerConnectionItems?profile=" + PROFILE,
                ADMIN), ORG, "the agent-step connection detail fill for an administrator");
    }

    @Test
    public void administratorCanRenderThePublisherConfigurationPage() throws Exception {
        Page page = get("job/" + JOB + "/configure", ADMIN);
        assertTrue("the publisher configuration page no longer renders for an administrator (HTTP "
                + status(page) + ")", status(page) < 400);
        assertTrue("the publisher configuration page lost its profile choices",
                body(page).contains(PROFILE));
    }
}
