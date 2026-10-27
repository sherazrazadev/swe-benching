package hidden.support;

import org.openremote.model.security.Role;
import org.openremote.model.security.User;

import java.util.*;

/** The tiny realm/user directory the fake identity provider answers from. */
public final class World {
    public final Map<String, String> realmOf = new LinkedHashMap<>();
    public final Map<String, String> nameOf = new LinkedHashMap<>();
    public final Map<String, String[]> clientRolesOf = new LinkedHashMap<>();
    public final Map<String, String[]> realmRolesOf = new LinkedHashMap<>();
    public final Set<String> realms = new LinkedHashSet<>();
    public final Map<String, List<Role>> roleDefsByRealm = new LinkedHashMap<>();
    /** Every createUpdateUser call, as {realm, user}. */
    public final List<Object[]> updates = new ArrayList<>();

    public World realm(String realm) {
        realms.add(realm);
        roleDefsByRealm.computeIfAbsent(realm, r -> new ArrayList<>());
        return this;
    }

    public World user(String id, String username, String realm) {
        realm(realm);
        realmOf.put(id, realm);
        nameOf.put(id, username);
        return this;
    }

    public World userClientRoles(String id, String... roles) {
        clientRolesOf.put(id, roles);
        return this;
    }

    public World userRealmRoles(String id, String... roles) {
        realmRolesOf.put(id, roles);
        return this;
    }

    public World roleDef(String realm, String name) {
        realm(realm);
        Role r = new Role();
        r.setId(realm + ":" + name);
        r.setName(name);
        roleDefsByRealm.get(realm).add(r);
        return this;
    }

    public User user(String id) {
        String realm = realmOf.get(id);
        if (realm == null) return null;
        User u = new User();
        u.setId(id);
        u.setRealm(realm);
        u.setUsername(nameOf.get(id));
        return u;
    }

    public boolean userInRealm(String id, String realm) {
        return realm != null && realm.equals(realmOf.get(id));
    }

    public String[] clientRoles(String realm, String userId, String client) {
        if (!userInRealm(userId, realm)) return new String[0];
        return clientRolesOf.getOrDefault(userId, new String[0]);
    }

    public String[] realmRoles(String realm, String userId) {
        if (!userInRealm(userId, realm)) return new String[0];
        return realmRolesOf.getOrDefault(userId, new String[0]);
    }

    public Role[] clientRoleDefs(String realm, String client) {
        List<Role> l = roleDefsByRealm.get(realm);
        return l == null ? new Role[0] : l.toArray(new Role[0]);
    }
}
