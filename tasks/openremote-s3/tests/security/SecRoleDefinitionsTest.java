package hidden.security;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;

/** Listing the roles a realm defines. */
public class SecRoleDefinitionsTest {

    public void testBuildingAdministratorCannotListMasterRoleDefinitions() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        Check.refused(() -> r.getClientRoles(null, Fixtures.MASTER, TestAuth.CLIENT),
            "master role definitions listed by a building administrator");
    }

    public void testBuildingUserCannotListCityRoleDefinitions() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        Check.refused(() -> r.getClientRoles(null, Fixtures.CITY, TestAuth.CLIENT),
            "city role definitions listed by a building user");
    }

    public void testBuildingAdministratorCannotListCityRoleDefinitions() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        Check.refused(() -> r.getClientRoles(null, Fixtures.CITY, TestAuth.CLIENT),
            "city role definitions listed by a building administrator");
    }
}
