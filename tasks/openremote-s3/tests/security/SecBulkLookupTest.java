package hidden.security;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.admin.UserAdminResourceImpl;
import org.openremote.model.security.User;

/** Resolving many user identifiers in one administrative request. */
public class SecBulkLookupTest {

    static UserAdminResourceImpl buildingAdmin(ManagerIdentityProvider p, MQTTBrokerService m) {
        return TestAuth.adminResource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
    }

    static boolean containsForeignRealm(Object value, String allowedRealm) {
        if (!(value instanceof User[] users)) {
            return true;
        }
        for (User user : users) {
            if (user == null || !allowedRealm.equals(user.getRealm())) {
                return true;
            }
        }
        return false;
    }

    public void testMixedIdentifiersDoNotReturnTheForeignUser() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = buildingAdmin(p, m);
        Check.blocked(
            () -> r.lookup(null, Fixtures.BUILDING,
                new String[]{Fixtures.BUILDING_USER2, Fixtures.MASTER_USER}),
            value -> containsForeignRealm(value, Fixtures.BUILDING),
            "bulk resolve returned a master user through the building path");
    }

    public void testForeignIdentifierOnlyDoesNotReturnTheForeignUser() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = buildingAdmin(p, m);
        Check.blocked(
            () -> r.lookup(null, Fixtures.BUILDING, new String[]{Fixtures.MASTER_USER}),
            value -> containsForeignRealm(value, Fixtures.BUILDING),
            "bulk resolve returned a master user through the building path");
    }

    public void testCityIdentifierDoesNotReturnTheForeignUser() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = buildingAdmin(p, m);
        Check.blocked(
            () -> r.lookup(null, Fixtures.BUILDING, new String[]{Fixtures.CITY_USER}),
            value -> containsForeignRealm(value, Fixtures.BUILDING),
            "bulk resolve returned a city user through the building path");
    }
}
