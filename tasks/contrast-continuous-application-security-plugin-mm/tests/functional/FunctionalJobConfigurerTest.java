package bench.ccas;

import org.junit.Test;

import static org.junit.Assert.assertTrue;

/**
 * A user who may configure the job (but is not a Jenkins administrator) keeps every choice the job
 * configuration page needs.
 */
public class FunctionalJobConfigurerTest extends BenchBase {

    private static final String JOB_ROOT = "job/" + JOB + "/" + DESCRIPTOR_ROOT;

    @Test
    public void jobConfigurerGetsPublisherProfileChoices() throws Exception {
        assertContains(get(JOB_ROOT + "VulnerabilityTrendRecorder/fillTeamServerProfileNameItems", CONFIGURER),
                PROFILE, "the publisher profile fill for a job configurer");
    }

    @Test
    public void jobConfigurerGetsGlobalConfigurationChoices() throws Exception {
        assertContains(get(JOB_ROOT + "ContrastPluginConfig/fillTeamServerProfileNameItems", CONFIGURER),
                PROFILE, "the profile fill for a job configurer");
        assertContains(get(JOB_ROOT + "ContrastPluginConfig/fillThresholdVulnTypeItems?teamServerProfileName="
                + PROFILE, CONFIGURER), RULE_TITLE, "the rule fill for a job configurer");
    }

    @Test
    public void jobConfigurerGetsPipelineStepChoices() throws Exception {
        assertContains(get(JOB_ROOT + "VulnerabilityTrendStep/fillProfileItems", CONFIGURER),
                PROFILE, "the pipeline-step profile fill for a job configurer");
        assertContains(get(JOB_ROOT + "VulnerabilityTrendStep/fillApplicationIdItems?profile=" + PROFILE,
                CONFIGURER), APP_TITLE, "the pipeline-step application fill for a job configurer");
        assertContains(get(JOB_ROOT + "VulnerabilityTrendStep/fillRuleItems?profile=" + PROFILE, CONFIGURER),
                RULE_TITLE, "the pipeline-step rule fill for a job configurer");
    }

    @Test
    public void jobConfigurerGetsAgentStepChoices() throws Exception {
        assertContains(get(JOB_ROOT + "ContrastAgentStep/fillProfileItems", CONFIGURER),
                PROFILE, "the agent-step profile fill for a job configurer");
    }

    @Test
    public void jobConfigurerGetsInjectedChoices() throws Exception {
        assertContains(get(JOB_ROOT + "GlobalThresholdCondition/fillTeamServerProfileNameItems", CONFIGURER),
                PROFILE, "the global threshold profile fill for a job configurer");
        assertContains(get(JOB_ROOT
                        + "GlobalThresholdCondition/fillThresholdVulnTypeItems?teamServerProfileName=" + PROFILE,
                CONFIGURER), RULE_TITLE, "the global threshold rule fill for a job configurer");
        assertContains(get(JOB_ROOT + "ContrastAgentStep/fillTeamServerConnectionItems?profile=" + PROFILE,
                CONFIGURER), ORG, "the agent-step connection detail fill for a job configurer");
    }

    @Test
    public void jobConfigurerGetsStepApplicationCheckWarning() throws Exception {
        org.htmlunit.Page page = post(JOB_ROOT + "VulnerabilityTrendStep/checkApplicationId",
                form("profile", PROFILE, "value", UNKNOWN_APP), CONFIGURER);
        assertTrue("the pipeline-step application check failed with HTTP " + status(page), status(page) < 400);
        assertTrue("an unknown application was not reported to the configuring user",
                body(page).toLowerCase().contains("not found"));
        assertNoTeamServerContact("a pipeline-step application check for a value absent from the profile");
    }
}
