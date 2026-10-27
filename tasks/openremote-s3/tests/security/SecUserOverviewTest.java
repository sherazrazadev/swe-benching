package hidden.security;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.admin.UserAdminResourceImpl;

/** Reading the summary of a user who belongs to another realm. */
public class SecUserOverviewTest {

    static UserAdminResourceImpl buildingAdmin(ManagerIdentityProvider p, MQTTBrokerService m) {
        return TestAuth.adminResource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
    }

    public void testMasterUserOverviewThroughOwnRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.overview(null, Fixtures.BUILDING, Fixtures.MASTER_USER),
            "overview of a master user read through the building path");
    }

    public void testCityUserOverviewThroughOwnRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = buildingAdmin(p, m);
        Check.refused(() -> r.overview(null, Fixtures.BUILDING, Fixtures.CITY_USER),
            "overview of a city user read through the building path");
    }

    public void testSuperUserOverviewOfUserOutsideTheNamedRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = TestAuth.adminResource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        Check.refused(() -> r.overview(null, Fixtures.MASTER, Fixtures.CITY_USER),
            "overview of a city user under the master path");
    }
}
