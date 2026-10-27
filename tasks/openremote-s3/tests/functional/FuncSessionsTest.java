package hidden.functional;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;
import org.openremote.model.security.UserSession;

/** Legitimate session reads and session control that must keep working. */
public class FuncSessionsTest {

    public void testSameRealmSessionsAreListed() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        UserSession[] sessions = r.getUserSessions(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        Check.equal(sessions.length, 1, "session count");
        Check.equal(sessions[0].getID(), Fixtures.SESSION_BUILDING, "session id");
    }

    public void testSuperUserListsSessionsAcrossRealms() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        UserSession[] building = r.getUserSessions(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        UserSession[] city = r.getUserSessions(null, Fixtures.CITY, Fixtures.CITY_USER);
        Check.equal(building.length, 1, "building session count");
        Check.equal(city.length, 1, "city session count");
    }

    public void testUserListsOwnSessions() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        UserSession[] sessions = r.getUserSessions(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        Check.equal(sessions.length, 1, "own session count");
    }

    public void testReadOnlyAdministratorListsPeerSessions() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.readAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        UserSession[] sessions = r.getUserSessions(null, Fixtures.BUILDING, Fixtures.BUILDING_USER2);
        Check.equal(sessions.length, 1, "peer session count for a read-only administrator");
    }

    public void testSameRealmAdministratorEndsASession() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        r.disconnectUserSession(null, Fixtures.BUILDING, Fixtures.SESSION_BUILDING2);
        Check.isTrue(!m.isConnected(Fixtures.SESSION_BUILDING2), "same-realm session must be ended");
    }

    public void testSuperUserEndsSessionsAcrossRealms() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.superUser(Fixtures.MASTER_ADMIN, "admin", Fixtures.MASTER), Fixtures.MASTER);
        r.disconnectUserSession(null, Fixtures.BUILDING, Fixtures.SESSION_BUILDING2);
        r.disconnectUserSession(null, Fixtures.CITY, Fixtures.SESSION_CITY);
        Check.isTrue(!m.isConnected(Fixtures.SESSION_BUILDING2), "building session ended by superuser");
        Check.isTrue(!m.isConnected(Fixtures.SESSION_CITY), "city session ended by superuser");
    }

    public void testMissingSessionIsNotFound() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        Check.refused(() -> r.disconnectUserSession(null, Fixtures.BUILDING, "no-such-session"),
            "unknown session id");
    }

    public void testUserEndsOwnSession() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        r.disconnectUserSession(null, Fixtures.BUILDING, Fixtures.SESSION_BUILDING);
        Check.isTrue(!m.isConnected(Fixtures.SESSION_BUILDING), "own session must be ended");
    }
}
