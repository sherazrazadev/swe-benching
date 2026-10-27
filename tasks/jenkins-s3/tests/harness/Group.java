package bench;

import hudson.model.DescribableGroupViewProperty;

/**
 * A concrete group property binding the injected base class's entry type to {@link Entry}.
 */
public class Group extends DescribableGroupViewProperty<Entry> {
    public String title;
}
