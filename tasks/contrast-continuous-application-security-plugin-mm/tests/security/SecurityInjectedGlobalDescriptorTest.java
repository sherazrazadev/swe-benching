package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

/** The global threshold condition exposes its own choice endpoints. */
public class SecurityInjectedGlobalDescriptorTest extends BenchBase {

    @Test
    public void globalThresholdProfileFillIsNotDisclosedToReader() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "GlobalThresholdCondition/fillTeamServerProfileNameItems", READER);
        assertNotDisclosed(page, PROFILE, "the connection-profile list from the global threshold form");
    }

    @Test
    public void globalThresholdRuleFillIsNotDisclosedToReaderInJobContext() throws Exception {
        Page page = get("job/" + JOB + "/" + DESCRIPTOR_ROOT
                        + "GlobalThresholdCondition/fillThresholdVulnTypeItems?teamServerProfileName=" + PROFILE,
                READER);
        assertNotDisclosed(page, RULE_TITLE, "the vulnerability-rule list from the global threshold form");
    }
}
