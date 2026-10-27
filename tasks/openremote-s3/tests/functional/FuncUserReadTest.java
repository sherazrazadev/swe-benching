package hidden.functional;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;
import org.openremote.model.security.User;

/** Legitimate reads that must keep working. */
public class FuncUserReadTest {

    public void testSameRealmUserRecordIsReturned() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        User u = r.get(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        Check.notNull(u, "user record");
        Check.equal(u.getId(), Fixtures.BUILDING_USER2, "user id");
        Check.equal(u.getRealm(), Fixtures.BUILDING, "user realm");
    }

    public void testUserReadsOwnRecordWithoutAdministrativeRole() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        User u = r.get(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        Check.notNull(u, "own record");
        Check.equal(u.getId(), Fixtures.BUILDING_USER2, "own record id");
    }

    public void testUserCannotReadPeerWithoutAdministrativeRole() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        Check.refused(() -> r.get(null, Fixtures.BUILDING, Fixtures.BUILDING_USER3),
            "peer record read without the administrative role");
    }

    public void testReadOnlyAdministratorReadsPeerOfOwnRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.readAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        User u = r.get(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        Check.notNull(u, "peer record for a read-only administrator");
        Check.equal(u.getId(), Fixtures.BUILDING_USER2, "peer id");
    }

    public void testSuperUserReadsUsersOfEveryRealm() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        User building = r.get(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        User city = r.get(null, Fixtures.CITY, Fixtures.CITY_USER);
        Check.equal(building.getId(), Fixtures.BUILDING_USER2, "building user read by superuser");
        Check.equal(city.getId(), Fixtures.CITY_USER, "city user read by superuser");
    }

    public void testCurrentUserRecordFollowsTheAuthenticatedIdentity() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        // Only a superuser may send a realm header that differs from the token realm; the call
        // must still describe the caller's own record, not one chosen by the header.
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.BUILDING);
        User me = r.getCurrent(null);
        Check.notNull(me, "current user");
        Check.equal(me.getId(), Fixtures.MASTER_ADMIN, "current user id");
        Check.equal(me.getRealm(), Fixtures.MASTER, "current user realm");
    }
}
