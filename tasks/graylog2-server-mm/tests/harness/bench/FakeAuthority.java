package bench;

import org.apache.shiro.authz.Permission;
import org.apache.shiro.subject.Subject;
import org.graylog.security.permissions.GRNPermission;
import org.mockito.Mockito;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * A stand-in for the authenticated subject. It answers per resource and verb, like the
 * real authorization layer: exact permission strings (edit, read, create) and the owner
 * capability expressed as an entity:own permission over a named resource.
 */
public final class FakeAuthority {
    private static final String OWN_PREFIX = "entity:own:";

    private final Set<String> allowed = new LinkedHashSet<>();
    private final Set<String> owned = new LinkedHashSet<>();
    private final Subject subject;

    public FakeAuthority() {
        subject = Mockito.mock(Subject.class);
        Mockito.when(subject.getPrincipal()).thenReturn("bench-user");
        Mockito.when(subject.isPermitted(Mockito.anyString())).thenAnswer(invocation -> {
            final String permission = invocation.getArgument(0, String.class);
            if (allowed.contains(permission)) {
                return true;
            }
            return permission.startsWith(OWN_PREFIX)
                    && owned.contains(permission.substring(OWN_PREFIX.length()));
        });
        Mockito.when(subject.isPermitted(Mockito.any(Permission.class))).thenAnswer(invocation -> {
            final Permission permission = invocation.getArgument(0, Permission.class);
            if (permission instanceof GRNPermission grnPermission) {
                return "entity:own".equals(grnPermission.type())
                        && owned.contains(grnPermission.target().toString());
            }
            return false;
        });
    }

    /** Allow one exact permission string, e.g. "view:edit:abc". */
    public FakeAuthority allow(String permission) {
        allowed.add(permission);
        return this;
    }

    /** Record the GRN of a resource the subject owns; accepts GRN.toString() or the Grn object. */
    public FakeAuthority own(Object grn) {
        owned.add(grn.toString());
        return this;
    }

    public Subject subject() {
        return subject;
    }
}
