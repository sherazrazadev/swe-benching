package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

/** A user with only overall read access must not learn the configured profile names. */
public class SecurityUncheckedPublisherTest extends BenchBase {

    @Test
    public void publisherProfileFillAtRootIsNotDisclosedToReader() throws Exception {
        Page page = get(DESCRIPTOR_ROOT + "VulnerabilityTrendRecorder/fillTeamServerProfileNameItems", READER);
        assertNotDisclosed(page, PROFILE, "the connection-profile list from the publisher form");
    }

    @Test
    public void publisherProfileFillInJobContextIsNotDisclosedToReader() throws Exception {
        Page page = get("job/" + JOB + "/" + DESCRIPTOR_ROOT
                + "VulnerabilityTrendRecorder/fillTeamServerProfileNameItems", READER);
        assertNotDisclosed(page, PROFILE, "the connection-profile list from the publisher form");
    }
}
