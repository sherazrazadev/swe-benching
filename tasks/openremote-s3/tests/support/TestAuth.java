package hidden.support;

import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.SecurityContext;
import org.openremote.container.security.TokenPrincipal;
import org.openremote.manager.mqtt.MQTTBrokerService;
import org.openremote.manager.security.ManagerIdentityProvider;
import org.openremote.manager.security.UserResourceImpl;
import org.openremote.manager.security.admin.UserAdminResourceImpl;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.security.Principal;
import java.util.*;

/** Builds the authenticated request the JAX-RS layer hands to the resource. */
public final class TestAuth {

    public static final String CLIENT = "openremote";
    public static final String READ_ADMIN = "read:admin";
    public static final String WRITE_ADMIN = "write:admin";
    public static final String READ_USERS = "read:users";
    public static final String SUPER_USER = "admin";

    public static TokenPrincipal principal(String realm, String userId, String username,
                                           List<String> realmRoles, List<String> clientRoles) {
        Map<String, Object> resourceAccess = new LinkedHashMap<>();
        resourceAccess.put(CLIENT, Map.of("roles", new ArrayList<>(clientRoles)));
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
            .issuer("https://localhost/realms/" + realm)
            .subject(userId)
            .claim("preferred_username", username)
            .claim("azp", CLIENT)
            .claim("realm_access", Map.of("roles", new ArrayList<>(realmRoles)))
            .claim("resource_access", resourceAccess)
            .build();
        try {
            return new TokenPrincipal(claims);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Token for a plain (non-superuser) user without administrative client roles. */
    public static TokenPrincipal plainUser(String realm, String userId, String username) {
        return principal(realm, userId, username, List.of(), List.of("write:user", READ_USERS));
    }

    /** Token for a user that administers its own realm. */
    public static TokenPrincipal realmAdmin(String realm, String userId, String username) {
        return principal(realm, userId, username, List.of(), List.of(READ_ADMIN, WRITE_ADMIN));
    }

    /** Token for a user that may read its own realm's users but may not write them. */
    public static TokenPrincipal readAdmin(String realm, String userId, String username) {
        return principal(realm, userId, username, List.of(), List.of(READ_ADMIN, READ_USERS));
    }

    /** Token for the master-realm superuser. */
    public static TokenPrincipal superUser(String userId, String username, String realm) {
        return principal(realm, userId, username, List.of(SUPER_USER), List.of(READ_ADMIN, WRITE_ADMIN));
    }

    /** Subject principal used for a broker connection owned by {@code userId}. */
    public static TokenPrincipal sessionPrincipal(String realm, String userId) {
        return principal(realm, userId, userId, List.of(), List.of());
    }

    public static HttpServletRequest request(String realmHeader) {
        return (HttpServletRequest) Proxy.newProxyInstance(
            TestAuth.class.getClassLoader(),
            new Class<?>[]{HttpServletRequest.class},
            (proxy, method, args) -> {
                switch (method.getName()) {
                    case "getHeader":
                        return "Realm".equalsIgnoreCase((String) args[0]) ? realmHeader : null;
                    case "getHeaderNames":
                        return Collections.enumeration(realmHeader == null ? List.of() : List.of("Realm"));
                    case "getHeaders":
                        return Collections.enumeration(realmHeader == null ? List.of() : List.of(realmHeader));
                    case "getRemoteAddr": return "127.0.0.1";
                    case "toString": return "TestRequest[Realm=" + realmHeader + "]";
                    case "hashCode": return System.identityHashCode(proxy);
                    case "equals": return proxy == args[0];
                    default: return FakeProvider.defaultValue(method.getReturnType());
                }
            });
    }

    public static SecurityContext securityContext(final Principal principal) {
        return (SecurityContext) Proxy.newProxyInstance(
            TestAuth.class.getClassLoader(),
            new Class<?>[]{SecurityContext.class},
            (proxy, method, args) -> {
                switch (method.getName()) {
                    case "getUserPrincipal": return principal;
                    case "isUserInRole": return true;
                    case "getAuthenticationScheme": return "Bearer";
                    case "toString": return "TestSecurityContext[" + principal + "]";
                    case "hashCode": return System.identityHashCode(proxy);
                    case "equals": return proxy == args[0];
                    default: return FakeProvider.defaultValue(method.getReturnType());
                }
            });
    }

    public static void inject(Object target, String field, Object value) {
        Class<?> c = target.getClass();
        while (c != null) {
            try {
                Field f = c.getDeclaredField(field);
                f.setAccessible(true);
                f.set(target, value);
                return;
            } catch (NoSuchFieldException e) {
                c = c.getSuperclass();
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException(e);
            }
        }
        throw new IllegalStateException("no field " + field);
    }

    /** The resource as the container would have it for one authenticated request. */
    public static UserResourceImpl resource(ManagerIdentityProvider provider,
                                            MQTTBrokerService mqtt,
                                            Principal principal,
                                            String realmHeader) {
        UserResourceImpl r = new UserResourceImpl(null, new FakeIdentityService(provider), mqtt);
        inject(r, "request", request(realmHeader));
        inject(r, "securityContext", securityContext(principal));
        return r;
    }

    /** The administration-console resource as the container would have it for one request. */
    public static UserAdminResourceImpl adminResource(ManagerIdentityProvider provider,
                                                      MQTTBrokerService mqtt,
                                                      Principal principal,
                                                      String realmHeader) {
        UserAdminResourceImpl r = new UserAdminResourceImpl(new FakeIdentityService(provider), mqtt);
        inject(r, "request", request(realmHeader));
        inject(r, "securityContext", securityContext(principal));
        return r;
    }
}
