package hidden.security;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;

/** Reading a user's record, role assignments or sessions across the realm boundary. */
public class SecUserReadTest {

    static UserResourceImpl buildingAdmin(ManagerIdentityProvider p, MQTTBrokerService m) {
        return TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
    }

    static UserResourceImpl superUser(ManagerIdentityProvider p, MQTTBrokerService m, String header) {
        return TestAuth.resource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), header);
    }

    public void testUserFromAnotherRealmIsNotReturnedThroughOwnRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.get(null, Fixtures.BUILDING, Fixtures.MASTER_USER),
            "user of master read through the building path");
    }

    public void testUserFromAnotherRealmIsNotReturnedThroughThatRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.get(null, Fixtures.MASTER, Fixtures.MASTER_USER),
            "master user read by a building administrator");
    }

    public void testSuperUserGetsNoUserOutsideTheNamedRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = superUser(p, m, Fixtures.MASTER);
        Check.refused(() -> r.get(null, Fixtures.MASTER, Fixtures.CITY_USER),
            "city user returned under the master path");
    }

    public void testClientRolesOfForeignUserThroughOwnRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.getUserClientRoles(null, Fixtures.BUILDING, Fixtures.MASTER_USER, TestAuth.CLIENT),
            "client roles of a master user read through the building path");
    }

    public void testClientRolesOfForeignUserThroughThatRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.getUserClientRoles(null, Fixtures.MASTER, Fixtures.MASTER_USER, TestAuth.CLIENT),
            "client roles of a master user read by a building administrator");
    }

    public void testRealmRolesOfForeignUser() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.getUserRealmRoles(null, Fixtures.MASTER, Fixtures.MASTER_USER),
            "realm roles of a master user read by a building administrator");
    }

    public void testSessionsOfForeignUserThroughOwnRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.getUserSessions(null, Fixtures.BUILDING, Fixtures.MASTER_USER),
            "sessions of a master user read through the building path");
    }

    public void testSessionsOfForeignUserThroughThatRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.getUserSessions(null, Fixtures.MASTER, Fixtures.MASTER_USER),
            "sessions of a master user read by a building administrator");
    }

    public void testCityUserIsNotReturnedThroughBuildingPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.get(null, Fixtures.BUILDING, Fixtures.CITY_USER),
            "city user read through the building path");
    }
}
