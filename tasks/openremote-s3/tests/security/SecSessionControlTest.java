package hidden.security;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;

/** Ending a session that belongs to another realm. */
public class SecSessionControlTest {

    public void testOtherRealmSessionSurvivesDisconnectThroughOwnRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        Check.refused(() -> r.disconnectUserSession(null, Fixtures.BUILDING, Fixtures.SESSION_MASTER),
            "master session ended through the building path");
        Check.isTrue(m.isConnected(Fixtures.SESSION_MASTER), "master session must still be connected");
    }

    public void testOtherRealmSessionSurvivesDisconnectOnItsOwnPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        Check.refused(() -> r.disconnectUserSession(null, Fixtures.MASTER, Fixtures.SESSION_MASTER),
            "master session ended by a building administrator naming master");
        Check.isTrue(m.isConnected(Fixtures.SESSION_MASTER), "master session must still be connected");
    }

    public void testCitySessionSurvivesDisconnectThroughOwnRealmPath() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.realmAdmin(Fixtures.BUILDING, Fixtures.BUILDING_USER3, "buildinguser3"), Fixtures.BUILDING);
        Check.refused(() -> r.disconnectUserSession(null, Fixtures.BUILDING, Fixtures.SESSION_CITY),
            "city session ended through the building path");
        Check.isTrue(m.isConnected(Fixtures.SESSION_CITY), "city session must still be connected");
    }

    public void testPlainUserCannotEndAnotherRealmsSession() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        Check.refused(() -> r.disconnectUserSession(null, Fixtures.BUILDING, Fixtures.SESSION_CITY),
            "city session ended by a building user");
        Check.isTrue(m.isConnected(Fixtures.SESSION_CITY), "city session must still be connected");
    }
}
