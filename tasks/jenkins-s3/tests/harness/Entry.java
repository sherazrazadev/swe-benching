package bench;

import hudson.model.Describable;
import hudson.model.Descriptor;

/**
 * A legitimate entry type for the injected group property.
 */
public class Entry implements Describable<Entry> {
    public String label;

    @Override
    public Descriptor<Entry> getDescriptor() {
        return null;
    }

    public static class DescriptorImpl extends Descriptor<Entry> {
    }
}
