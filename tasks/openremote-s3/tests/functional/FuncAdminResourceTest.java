package hidden.functional;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.admin.UserAdminResourceImpl;
import org.openremote.model.security.User;
import org.openremote.model.security.UserOverview;

import java.util.Arrays;

/** Legitimate administration-console reads that must keep working. */
public class FuncAdminResourceTest {

    public void testAdministratorResolvesUsersOfOwnRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = TestAuth.adminResource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        User[] users = r.lookup(null, Fixtures.BUILDING,
            new String[]{Fixtures.BUILDING_USER2, Fixtures.BUILDING_USER3});
        Check.equal(users.length, 2, "resolved user count");
        Check.equal(users[0].getId(), Fixtures.BUILDING_USER2, "first resolved id");
        Check.equal(users[1].getId(), Fixtures.BUILDING_USER3, "second resolved id");
    }

    public void testEmptyResolveReturnsNothing() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = TestAuth.adminResource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        User[] users = r.lookup(null, Fixtures.BUILDING, new String[0]);
        Check.equal(users.length, 0, "empty resolve");
    }

    public void testSuperUserResolvesUsersOfTheNamedRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = TestAuth.adminResource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        User[] users = r.lookup(null, Fixtures.BUILDING, new String[]{Fixtures.BUILDING_USER2});
        Check.equal(users.length, 1, "superuser resolve count");
        Check.equal(users[0].getId(), Fixtures.BUILDING_USER2, "superuser resolved id");
    }

    public void testAdministratorReadsTheOverviewOfAUserOfOwnRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = TestAuth.adminResource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        UserOverview overview = r.overview(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        Check.equal(overview.getUserId(), Fixtures.BUILDING_USER2, "overview user id");
        Check.equal(overview.getUsername(), "buildinguser2", "overview username");
        Check.equal(overview.getRealm(), Fixtures.BUILDING, "overview realm");
        Check.isTrue(Arrays.asList(overview.getClientRoles()).contains("write:user"), "overview client roles");
        Check.equal(overview.getSessionCount(), 1, "overview session count");
    }

    public void testReadOnlyAdministratorReadsTheOverviewOfAUserOfOwnRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = TestAuth.adminResource(p, m,
            TestAuth.readAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        UserOverview overview = r.overview(null, Fixtures.BUILDING, Fixtures.BUILDING_USER3);
        Check.equal(overview.getUserId(), Fixtures.BUILDING_USER3, "overview user id");
        Check.equal(overview.getRealm(), Fixtures.BUILDING, "overview realm");
    }

    public void testSuperUserReadsTheOverviewOfAUserOfTheNamedRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserAdminResourceImpl r = TestAuth.adminResource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        UserOverview overview = r.overview(null, Fixtures.CITY, Fixtures.CITY_USER);
        Check.equal(overview.getUserId(), Fixtures.CITY_USER, "overview user id");
        Check.equal(overview.getRealm(), Fixtures.CITY, "overview realm");
    }
}
