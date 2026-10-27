package bench;

import hudson.model.FreeStyleProject;
import hudson.model.JobProperty;

/**
 * A legitimate job property of the type a job's property collection declares to hold.
 */
public class LegitJobProperty extends JobProperty<FreeStyleProject> {
    public String label;
}
