package hidden.support;

import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.model.security.Role;
import org.openremote.model.security.User;

import java.lang.reflect.Proxy;

/** ManagerIdentityProvider backed by World; mirrors how the real provider uses the realm argument. */
public final class FakeProvider {
    public static ManagerIdentityProvider of(final World w) {
        return (ManagerIdentityProvider) Proxy.newProxyInstance(
            FakeProvider.class.getClassLoader(),
            new Class<?>[]{ManagerIdentityProvider.class},
            (proxy, method, args) -> {
                String n = method.getName();
                switch (n) {
                    case "getUser": return w.user((String) args[0]);
                    case "getUserByUsername": {
                        for (var e : w.realmOf.entrySet()) {
                            if (e.getValue().equals(args[0]) && w.nameOf.get(e.getKey()).equals(args[1])) {
                                return w.user(e.getKey());
                            }
                        }
                        return null;
                    }
                    case "isUserInRealm": return w.userInRealm((String) args[0], (String) args[1]);
                    case "createUpdateUser": {
                        w.updates.add(new Object[]{args[0], args[1]});
                        return args[1];
                    }
                    case "updateUserClientRoles": return null;
                    case "updateUserRealmRoles": return null;
                    case "updateClientRoles": return null;
                    case "getUserClientRoles": return w.clientRoles((String) args[0], (String) args[1], (String) args[2]);
                    case "getUserRealmRoles": return w.realmRoles((String) args[0], (String) args[1]);
                    case "getClientRoles": return w.clientRoleDefs((String) args[0], (String) args[1]);
                    case "realmExists": return w.realms.contains((String) args[0]);
                    case "getRealm": return w.realms.contains((String) args[0])
                        ? new org.openremote.model.security.Realm(null, (String) args[0], (String) args[0], true) : null;
                    case "getRealms": {
                        return w.realms.stream().map(r -> new org.openremote.model.security.Realm(null, r, r, true))
                            .toArray(org.openremote.model.security.Realm[]::new);
                    }
                    case "isRealmActiveAndAccessible": return args[1] instanceof String
                        ? w.realms.contains((String) args[1]) : true;
                    case "isMasterRealmAdmin": return false;
                    case "isRestrictedUser": return false;
                    case "queryUsers": return new User[0];
                    case "toString": return "FakeIdentityProvider";
                    case "hashCode": return System.identityHashCode(proxy);
                    case "equals": return proxy == args[0];
                    default: return defaultValue(method.getReturnType());
                }
            });
    }

    static Object defaultValue(Class<?> t) {
        if (!t.isPrimitive()) return null;
        if (t == boolean.class) return false;
        if (t == char.class) return '\0';
        if (t == byte.class) return (byte) 0;
        if (t == short.class) return (short) 0;
        if (t == int.class) return 0;
        if (t == long.class) return 0L;
        if (t == float.class) return 0f;
        if (t == double.class) return 0d;
        return null;
    }
}
