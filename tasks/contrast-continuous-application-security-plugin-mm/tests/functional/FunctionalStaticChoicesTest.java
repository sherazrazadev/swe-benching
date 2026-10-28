package bench.ccas;

import org.junit.Test;

/** Choices that do not come from a connection profile stay open to any signed-in user. */
public class FunctionalStaticChoicesTest extends BenchBase {

    @Test
    public void readerGetsAgentTypeChoices() throws Exception {
        assertContains(get(DESCRIPTOR_ROOT + "ContrastAgentStep/fillAgentTypeItems", READER),
                "Java", "the agent-type list for a read-only user");
    }

    @Test
    public void readerGetsSeverityChoices() throws Exception {
        assertContains(get(DESCRIPTOR_ROOT + "VulnerabilityTrendStep/fillSeverityItems", READER),
                "Critical", "the severity list for a read-only user");
    }

    @Test
    public void readerGetsThresholdSeverityChoices() throws Exception {
        assertContains(get("job/" + JOB + "/" + DESCRIPTOR_ROOT + "ThresholdCondition/fillThresholdSeverityItems",
                READER), "Critical", "the threshold severity list for a read-only user");
    }
}
