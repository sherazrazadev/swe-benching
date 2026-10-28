package bench;

import com.google.common.collect.ImmutableMap;
import org.graylog.grn.GRNTypes;
import org.graylog.security.Capability;
import org.graylog.security.shares.EntityShareRequest;

/** Builds sharing instructions the way the product's update body carries them. */
public final class Shares {
    private Shares() {
    }

    public static EntityShareRequest grant(String granteeId) {
        return grant(granteeId, Capability.VIEW);
    }

    public static EntityShareRequest grant(String granteeId, Capability capability) {
        return EntityShareRequest.create(ImmutableMap.of(GRNTypes.USER.toGRN(granteeId), capability));
    }

    /** A sharing instruction that names no grantee; applying it removes the existing grants. */
    public static EntityShareRequest unshareAll() {
        return EntityShareRequest.EMPTY;
    }
}
