package bench.ccas;

import org.htmlunit.Page;
import org.junit.Test;

import static org.junit.Assert.assertTrue;

/** Authorised configuration lookups keep working, including the TeamServer-backed ones. */
public class FunctionalAuthorizedLookupTest extends BenchBase {

    @Test
    public void authorisedApplicationFillRefreshesFromTeamServer() throws Exception {
        teamServer.reset();

        Page page = post("job/" + JOB + "/" + DESCRIPTOR_ROOT + "ThresholdCondition/fillApplicationIdItems",
                form("teamServerProfileName", PROFILE), CONFIGURER);

        assertTrue("the authorised application fill failed with HTTP " + status(page), status(page) < 400);
        assertTrue("the authorised application fill did not refresh from the TeamServer",
                teamServer.count() > 0);
        assertContains(get("job/" + JOB + "/" + DESCRIPTOR_ROOT
                + "ContrastPluginConfig/fillTeamServerProfileNameItems", CONFIGURER),
                PROFILE, "the profile list after an authorised refresh");
    }

    @Test
    public void authorisedApplicationCheckWithUnknownValueWarnsWithoutContact() throws Exception {
        teamServer.reset();

        Page page = post("job/" + JOB + "/" + DESCRIPTOR_ROOT + "ThresholdCondition/checkApplicationId",
                form("teamServerProfileName", PROFILE, "value", UNKNOWN_APP), CONFIGURER);

        assertTrue("the authorised application check failed with HTTP " + status(page), status(page) < 400);
        assertTrue("an unknown application was not reported to the configuring user",
                body(page).toLowerCase().contains("not found"));
        assertNoTeamServerContact("an application check for a value absent from the profile");
    }
}
