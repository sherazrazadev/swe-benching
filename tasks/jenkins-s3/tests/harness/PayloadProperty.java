package bench;

import hudson.model.ViewProperty;

/**
 * A legitimate view property whose payload field is declared as {@link Object}, so the field
 * admits any value. Used to supply internal objects through an otherwise legitimate element.
 */
public class PayloadProperty extends ViewProperty {
    public Object payload;
    public String label;
}
