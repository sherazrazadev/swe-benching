package hidden.support;

import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.ManagerIdentityService;

/** ManagerIdentityService whose provider is the fake directory. */
public class FakeIdentityService extends ManagerIdentityService {
    private final ManagerIdentityProvider provider;

    public FakeIdentityService(ManagerIdentityProvider provider) {
        this.provider = provider;
    }

    @Override
    public ManagerIdentityProvider getIdentityProvider() {
        return provider;
    }
}
