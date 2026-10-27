package hidden.functional;

import hidden.support.*;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;
import org.openremote.model.security.User;

/** Updating the caller's own locale keeps addressing the caller's own record. */
public class FuncLocaleTest {

    public void testUserUpdatesOwnLocale() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        r.updateCurrentUserLocale(null, "\"nl\"");
        Check.isTrue(w.updates.size() == 1, "one user update");
        Check.equal(w.updates.get(0)[0], Fixtures.BUILDING, "update realm");
        Check.equal(((User) w.updates.get(0)[1]).getId(), Fixtures.BUILDING_USER2, "update user id");
        User updated = (User) w.updates.get(0)[1];
        String locale = updated.getAttributes().stream()
            .filter(a -> a.getName().equals(User.LOCALE_ATTRIBUTE))
            .map(a -> a.getValue()).findFirst().orElse(null);
        Check.equal(locale, "nl", "locale value");
    }

    public void testCurrentUserRecordIsReadableForANormalUser() {
        World w = Fixtures.world();
        ManagerIdentityProvider p = Fixtures.provider(w);
        FakeMqttBrokerService m = Fixtures.broker();
        UserResourceImpl r = TestAuth.resource(p, m,
            TestAuth.plainUser(Fixtures.BUILDING, Fixtures.BUILDING_USER2, "buildinguser2"), Fixtures.BUILDING);
        User me = r.getCurrent(null);
        Check.equal(me.getId(), Fixtures.BUILDING_USER2, "current user id");
    }
}
