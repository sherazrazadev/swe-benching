package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

/**
 * A user who may configure jobs but is not a Jenkins administrator must not receive the choices of
 * the controller-wide configuration through the root descriptor endpoints.
 */
public class SecurityWrongContextFillTest extends BenchBase {

    @Test
    public void globalConfigurationProfileFillIsNotDisclosedToGlobalConfigurer() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "ContrastPluginConfig/fillTeamServerProfileNameItems", CONFIGURER);
        assertNotDisclosed(page, PROFILE, "the global connection-profile list");
    }

    @Test
    public void globalConfigurationRuleFillIsNotDisclosedToGlobalConfigurer() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "ContrastPluginConfig/fillThresholdVulnTypeItems?teamServerProfileName="
                + PROFILE, CONFIGURER);
        assertNotDisclosed(page, RULE_TITLE, "the global vulnerability-rule list");
    }

    @Test
    public void agentStepProfileFillIsNotDisclosedToGlobalConfigurer() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "ContrastAgentStep/fillProfileItems", CONFIGURER);
        assertNotDisclosed(page, PROFILE, "the connection-profile list from the agent step");
    }

    @Test
    public void pipelineStepProfileFillIsNotDisclosedToGlobalConfigurer() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "VulnerabilityTrendStep/fillProfileItems", CONFIGURER);
        assertNotDisclosed(page, PROFILE, "the connection-profile list from the pipeline step");
    }

    @Test
    public void pipelineStepApplicationFillIsNotDisclosedToGlobalConfigurer() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "VulnerabilityTrendStep/fillApplicationIdItems?profile=" + PROFILE,
                CONFIGURER);
        assertNotDisclosed(page, APP_TITLE, "the application list from the pipeline step");
    }

    @Test
    public void pipelineStepRuleFillIsNotDisclosedToGlobalConfigurer() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "VulnerabilityTrendStep/fillRuleItems?profile=" + PROFILE, CONFIGURER);
        assertNotDisclosed(page, RULE_TITLE, "the vulnerability-rule list from the pipeline step");
    }
}
