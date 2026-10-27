package bench;

import hudson.model.Node;
import hudson.slaves.NodeProperty;

/**
 * A legitimate node property of the type an agent's property collection declares to hold.
 */
public class LegitNodeProperty extends NodeProperty<Node> {
    public String label;
}
