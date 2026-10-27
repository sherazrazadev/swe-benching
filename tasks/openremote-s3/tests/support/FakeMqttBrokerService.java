package hidden.support;

import com.nimbusds.jwt.JWTClaimsSet;
import org.apache.activemq.artemis.spi.core.protocol.RemotingConnection;
import org.openremote.container.security.TokenPrincipal;
import org.openremote.manager.mqtt.MQTTBrokerService;

import javax.security.auth.Subject;
import java.lang.reflect.Proxy;
import java.security.Principal;
import java.util.*;

/**
 * In-process stand-in for the MQTT broker: keeps a table of live sessions and records the
 * force-disconnects the resource asks for, so a test can see whether a session survived.
 */
public class FakeMqttBrokerService extends MQTTBrokerService {

    public static final class Session {
        public final String id;
        public final String userId;
        final RemotingConnection connection;
        public boolean connected = true;
        Session(String id, String userId, RemotingConnection c) {
            this.id = id;
            this.userId = userId;
            this.connection = c;
        }
    }

    private final Map<String, Session> sessions = new LinkedHashMap<>();
    public final List<String> disconnected = new ArrayList<>();

    public FakeMqttBrokerService() {
    }

    public Session addSession(String id, String userId) {
        return addSession(id, userId, null);
    }

    public Session addSession(String id, String userId, String realm) {
        RemotingConnection c = connection(id, userId, realm == null ? "master" : realm);
        Session s = new Session(id, userId, c);
        sessions.put(id, s);
        connectionIDConnectionMap.put(id, c);
        return s;
    }

    public Session get(String id) {
        return sessions.get(id);
    }

    public boolean isConnected(String id) {
        Session s = sessions.get(id);
        return s != null && s.connected;
    }

    // no @Override: the parameter/return shapes are the ones the product exposes today
    public void doForceDisconnect(RemotingConnection connection) {
        for (Session s : sessions.values()) {
            if (s.connection == connection) {
                s.connected = false;
                disconnected.add(s.id);
                connectionIDConnectionMap.remove(s.id);
                return;
            }
        }
    }

    // no @Override for the same reason
    public Set<RemotingConnection> getUserConnections(String userId) {
        Set<RemotingConnection> out = new LinkedHashSet<>();
        for (Session s : sessions.values()) {
            if (s.connected && Objects.equals(s.userId, userId)) out.add(s.connection);
        }
        return out;
    }

    static RemotingConnection connection(String id, String userId, String realm) {
        Subject subject = new Subject();
        subject.getPrincipals().add(TestAuth.sessionPrincipal(realm, userId));
        return (RemotingConnection) Proxy.newProxyInstance(
            FakeMqttBrokerService.class.getClassLoader(),
            new Class<?>[]{RemotingConnection.class},
            (proxy, method, args) -> {
                switch (method.getName()) {
                    case "getID": return id;
                    case "getClientID": return "client-" + id;
                    case "getSubject": return subject;
                    case "getRemoteAddress": return "127.0.0.1";
                    case "getCreationTime": return 1_700_000_000_000L;
                    case "disconnect": return Boolean.TRUE;
                    case "toString": return "TestConnection[" + id + "]";
                    case "hashCode": return System.identityHashCode(proxy);
                    case "equals": return proxy == args[0];
                    default: return FakeProvider.defaultValue(method.getReturnType());
                }
            });
    }

}
