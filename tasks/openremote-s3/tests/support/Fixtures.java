package hidden.support;

import org.openremote.manager.security.ManagerIdentityProvider;

/** One fixed directory used by every case: three realms and users with known ownership. */
public final class Fixtures {
    public static final String MASTER = "master";
    public static final String BUILDING = "building";
    public static final String CITY = "city";

    public static final String MASTER_ADMIN = "master-admin";
    public static final String MASTER_USER = "master-user";
    public static final String MASTER_USER2 = "master-user2";
    public static final String BUILDING_USER2 = "building-user2";
    public static final String BUILDING_USER3 = "building-user3";
    public static final String CITY_USER = "city-user";

    public static final String SESSION_BUILDING = "session-building";
    public static final String SESSION_BUILDING2 = "session-building2";
    public static final String SESSION_MASTER = "session-master";
    public static final String SESSION_CITY = "session-city";

    private Fixtures() {
    }

    public static World world() {
        return new World()
            .realm(MASTER).realm(BUILDING).realm(CITY)
            .user(MASTER_ADMIN, "admin", MASTER)
            .user(MASTER_USER, "masteruser", MASTER)
            .user(MASTER_USER2, "masteruser2", MASTER)
            .user(BUILDING_USER2, "buildinguser2", BUILDING)
            .user(BUILDING_USER3, "buildinguser3", BUILDING)
            .user(CITY_USER, "cityuser", CITY)
            .userClientRoles(BUILDING_USER2, "write:user", "read:users")
            .userClientRoles(BUILDING_USER3, "write:user")
            .userClientRoles(MASTER_USER, "read:admin")
            .userRealmRoles(BUILDING_USER3, "test-realm-role")
            .userRealmRoles(MASTER_USER, "master-role")
            .roleDef(BUILDING, "read:admin").roleDef(BUILDING, "write:admin").roleDef(BUILDING, "write:user")
            .roleDef(MASTER, "read:admin").roleDef(MASTER, "master-role")
            .roleDef(CITY, "read:admin");
    }

    public static ManagerIdentityProvider provider(World world) {
        return FakeProvider.of(world);
    }

    public static FakeMqttBrokerService broker() {
        FakeMqttBrokerService mqtt = new FakeMqttBrokerService();
        mqtt.addSession(SESSION_BUILDING, BUILDING_USER2, BUILDING);
        mqtt.addSession(SESSION_BUILDING2, BUILDING_USER3, BUILDING);
        mqtt.addSession(SESSION_MASTER, MASTER_USER, MASTER);
        mqtt.addSession(SESSION_CITY, CITY_USER, CITY);
        return mqtt;
    }
}
