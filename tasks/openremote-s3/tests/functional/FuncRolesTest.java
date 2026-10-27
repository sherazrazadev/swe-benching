package hidden.functional;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;
import org.openremote.model.security.Role;

import java.util.Arrays;
import java.util.List;

/** Legitimate role reads that must keep working. */
public class FuncRolesTest {

    public void testSameRealmRoleAssignmentsAreReturned() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        String[] client = r.getUserClientRoles(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2, TestAuth.CLIENT);
        String[] realm = r.getUserRealmRoles(null, Fixtures.BUILDING, Fixtures.BUILDING_USER3);
        Check.isTrue(Arrays.asList(client).contains("write:user"), "client roles contain write:user");
        Check.isTrue(Arrays.asList(realm).contains("test-realm-role"), "realm roles contain the test role");
    }

    public void testUserReadsOwnRoles() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        String[] client = r.getUserClientRoles(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2, TestAuth.CLIENT);
        Check.isTrue(Arrays.asList(client).contains("read:users"), "own client roles");
        String[] viaCurrent = r.getCurrentUserRealmRoles(null);
        Check.notNull(viaCurrent, "own realm roles");
    }

    public void testReadOnlyAdministratorReadsPeerRoles() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.readAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        String[] client = r.getUserClientRoles(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2, TestAuth.CLIENT);
        String[] realm = r.getUserRealmRoles(null, Fixtures.BUILDING, Fixtures.BUILDING_USER3);
        Check.isTrue(Arrays.asList(client).contains("write:user"), "peer client roles");
        Check.isTrue(Arrays.asList(realm).contains("test-realm-role"), "peer realm roles");
    }

    public void testSuperUserReadsRoleAssignmentsAcrossRealms() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        String[] building = r.getUserClientRoles(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2, TestAuth.CLIENT);
        String[] city = r.getUserRealmRoles(null, Fixtures.CITY, Fixtures.CITY_USER);
        Check.isTrue(Arrays.asList(building).contains("write:user"), "superuser reads building client roles");
        Check.notNull(city, "superuser reads city realm roles");
    }

    public void testSameRealmRoleDefinitionsAreListed() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        Role[] roles = r.getClientRoles(null, Fixtures.BUILDING, TestAuth.CLIENT);
        List<String> names = Arrays.stream(roles).map(Role::getName).toList();
        Check.isTrue(names.contains("read:admin"), "building role definitions contain read:admin");
        Check.isTrue(names.contains("write:user"), "building role definitions contain write:user");
    }

    public void testSuperUserListsRoleDefinitionsOfEveryRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        Role[] building = r.getClientRoles(null, Fixtures.BUILDING, TestAuth.CLIENT);
        Role[] city = r.getClientRoles(null, Fixtures.CITY, TestAuth.CLIENT);
        Check.isTrue(building.length >= 3, "building role definitions");
        Check.isTrue(city.length >= 1, "city role definitions");
    }
}
