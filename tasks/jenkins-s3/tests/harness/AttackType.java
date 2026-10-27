package bench;

import hudson.model.Describable;
import hudson.model.Descriptor;

/**
 * A configuration value of a type that no setting collection in the suites declares to hold.
 */
public class AttackType implements Describable<AttackType> {
    public String value;

    @Override
    public Descriptor<AttackType> getDescriptor() {
        return null;
    }

    public static class DescriptorImpl extends Descriptor<AttackType> {
    }
}
