package io.bench.oauth2;

import org.hswebframework.web.authorization.Authentication;
import org.hswebframework.web.authorization.ReactiveAuthenticationHolder;
import org.hswebframework.web.authorization.ReactiveAuthenticationSupplier;
import org.hswebframework.web.authorization.simple.SimpleAuthentication;
import org.hswebframework.web.authorization.simple.SimpleUser;
import org.hswebframework.web.exception.BusinessException;
import org.hswebframework.web.oauth2.server.AccessToken;
import org.hswebframework.web.oauth2.server.AccessTokenManager;
import org.hswebframework.web.oauth2.server.OAuth2Client;
import org.hswebframework.web.oauth2.server.OAuth2ClientManager;
import org.hswebframework.web.oauth2.server.OAuth2GrantService;
import org.hswebframework.web.oauth2.server.OAuth2Properties;
import org.hswebframework.web.oauth2.server.code.AuthorizationCodeCache;
import org.hswebframework.web.oauth2.server.code.AuthorizationCodeGranter;
import org.hswebframework.web.oauth2.server.code.DefaultAuthorizationCodeGranter;
import org.hswebframework.web.oauth2.server.credential.ClientCredentialGranter;
import org.hswebframework.web.oauth2.server.refresh.RefreshTokenGranter;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.ReactiveRedisOperations;
import org.springframework.data.redis.core.ReactiveValueOperations;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.reactive.server.EntityExchangeResult;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import reactor.core.publisher.Mono;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Drives the OAuth2 authorization server's own controllers over real HTTP semantics: WebFlux
 * request mapping, query and form binding, and exception mapping. The collaborator interfaces a
 * deployment provides are stubbed per client, and the authorization-code store is an in-memory
 * stand-in that round-trips the cache object through Java serialization, as the real store does.
 */
public final class Harness {

    /** Client whose registered callback carries a path. */
    public static final String CLIENT_ID = "confidential-client";
    public static final String CLIENT_SECRET = "s3cret";
    public static final String CALLBACK = "https://trusted.example.com/callback";

    /** Client whose registered callback is a bare origin. */
    public static final String ORIGIN_CLIENT_ID = "first-party-client";
    public static final String ORIGIN = "https://trusted.example.com";

    private static final String AUTHORIZE = "/oauth2/authorize";
    private static final String LEGACY_AUTHORIZE = "/oauth2/authorize/legacy";
    private static final String TOKEN = "/oauth2/token";

    private final WebTestClient web;
    private final Clients clients = new Clients();

    public Harness() {
        installAuthentication();
        SerializedStore store = new SerializedStore();
        Object controller = buildController(new GrantService(store), clients, new OAuth2Properties());
        this.web = WebTestClient
            .bindToController(controller)
            .controllerAdvice(new RefusalAdvice())
            .build();
    }

    /** Register a client and its callback; each test registers the clients it uses. */
    public Harness client(String clientId, String secret, String registeredCallback) {
        clients.put(clientId, secret, registeredCallback);
        return this;
    }

    public Harness standardClients() {
        return client(CLIENT_ID, CLIENT_SECRET, CALLBACK)
            .client(ORIGIN_CLIENT_ID, "origin-secret", ORIGIN);
    }

    public static final class Result {
        public final int status;
        public final String body;

        Result(int status, String body) {
            this.status = status;
            this.body = body == null ? "" : body;
        }

        public boolean isClientError() {
            return status >= 400 && status < 500;
        }

        public boolean isSuccess() {
            return status >= 200 && status < 300;
        }

        @Override
        public String toString() {
            return "status=" + status + " body=" + body;
        }
    }

    public Result authorize(String clientId, String redirectUri) {
        return authorize(clientId, redirectUri, "state-1", AUTHORIZE);
    }

    public Result authorize(String clientId, String redirectUri, String state) {
        return authorize(clientId, redirectUri, state, AUTHORIZE);
    }

    public Result legacyAuthorize(String clientId, String redirectUri) {
        return authorize(clientId, redirectUri, "state-1", LEGACY_AUTHORIZE);
    }

    private Result authorize(String clientId, String redirectUri, String state, String path) {
        WebTestClient.RequestHeadersSpec<?> spec = web
            .get()
            .uri(builder -> {
                builder.path(path)
                       .queryParam("response_type", "code")
                       .queryParam("client_id", clientId);
                if (redirectUri != null) {
                    builder.queryParam("redirect_uri", redirectUri);
                }
                if (state != null) {
                    builder.queryParam("state", state);
                }
                return builder.build();
            });
        return run(spec);
    }

    public Result exchangeGet(String clientId, String secret, String code, String redirectUri) {
        WebTestClient.RequestHeadersSpec<?> spec = web
            .get()
            .uri(builder -> {
                builder.path(TOKEN)
                       .queryParam("grant_type", "authorization_code")
                       .queryParam("client_id", clientId)
                       .queryParam("client_secret", secret)
                       .queryParam("code", code);
                if (redirectUri != null) {
                    builder.queryParam("redirect_uri", redirectUri);
                }
                return builder.build();
            });
        return run(spec);
    }

    public Result exchangePost(String clientId, String secret, String code, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", clientId);
        form.add("client_secret", secret);
        form.add("code", code);
        if (redirectUri != null) {
            form.add("redirect_uri", redirectUri);
        }
        return run(web
                       .post()
                       .uri(TOKEN)
                       .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                       .bodyValue(form));
    }

    public Result run(WebTestClient.RequestHeadersSpec<?> spec) {
        EntityExchangeResult<String> result = spec
            .exchange()
            .expectBody(String.class)
            .returnResult();
        return new Result(result.getStatus().value(), result.getResponseBody());
    }

    public static String codeFrom(String redirectUrl) {
        if (redirectUrl == null) {
            return null;
        }
        int at = redirectUrl.indexOf("code=");
        if (at < 0) {
            return null;
        }
        int start = at + "code=".length();
        int end = redirectUrl.indexOf('&', start);
        String value = end < 0 ? redirectUrl.substring(start) : redirectUrl.substring(start, end);
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    public static Authentication userAuthentication() {
        SimpleAuthentication authentication = new SimpleAuthentication();
        authentication.setUser(SimpleUser.builder().id("bench-user").username("bench").build());
        return authentication;
    }

    private static void installAuthentication() {
        Authentication authentication = userAuthentication();
        ReactiveAuthenticationHolder.setSupplier(new ReactiveAuthenticationSupplier() {
            @Override
            public Mono<Authentication> get() {
                return Mono.just(authentication);
            }

            @Override
            public Mono<Authentication> get(String userId) {
                return Mono.just(authentication);
            }
        });
    }

    private static Object buildController(OAuth2GrantService grantService,
                                          OAuth2ClientManager clientManager,
                                          OAuth2Properties properties) {
        try {
            Class<?> type = Class.forName(
                "org.hswebframework.web.oauth2.server.web.OAuth2AuthorizeController");
            for (Constructor<?> constructor : type.getConstructors()) {
                Class<?>[] parameterTypes = constructor.getParameterTypes();
                Object[] arguments = new Object[parameterTypes.length];
                boolean usable = true;
                for (int i = 0; i < parameterTypes.length; i++) {
                    if (parameterTypes[i] == OAuth2GrantService.class) {
                        arguments[i] = grantService;
                    } else if (parameterTypes[i] == OAuth2ClientManager.class) {
                        arguments[i] = clientManager;
                    } else if (parameterTypes[i] == OAuth2Properties.class) {
                        arguments[i] = properties;
                    } else {
                        usable = false;
                        break;
                    }
                }
                if (usable) {
                    return constructor.newInstance(arguments);
                }
            }
            throw new IllegalStateException("no usable authorization controller constructor");
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("cannot build the authorization controller", e);
        }
    }

    /** Per-client registry, answering each client id with its own secret and callback. */
    private static final class Clients implements OAuth2ClientManager {
        private final Map<String, OAuth2Client> clients = new HashMap<>();

        void put(String clientId, String secret, String callback) {
            OAuth2Client client = new OAuth2Client();
            client.setClientId(clientId);
            client.setClientSecret(secret);
            client.setName(clientId);
            client.setRedirectUrl(callback);
            clients.put(clientId, client);
        }

        @Override
        public Mono<OAuth2Client> getClient(String clientId) {
            return Mono.justOrEmpty(clients.get(clientId));
        }
    }

    /**
     * Hands out a fresh granter per call so a redirect target must travel through the shared code
     * store, not through state held by one granter instance.
     */
    private static final class GrantService implements OAuth2GrantService {
        private final SerializedStore store;

        GrantService(SerializedStore store) {
            this.store = store;
        }

        @Override
        public AuthorizationCodeGranter authorizationCode() {
            return new DefaultAuthorizationCodeGranter(new Tokens(),
                                                       (ApplicationEventPublisher) event -> {
                                                       },
                                                       store.operations());
        }

        @Override
        public ClientCredentialGranter clientCredential() {
            throw new UnsupportedOperationException("not used by this harness");
        }

        @Override
        public RefreshTokenGranter refreshToken() {
            throw new UnsupportedOperationException("not used by this harness");
        }
    }

    private static final class Tokens implements AccessTokenManager {
        @Override
        public Mono<Authentication> getAuthenticationByToken(String accessToken) {
            return Mono.empty();
        }

        @Override
        public Mono<AccessToken> createAccessToken(String clientId,
                                                   Authentication authentication,
                                                   boolean singleton) {
            return Mono.just(new AccessToken("access-token-" + clientId, "refresh-token", 7200));
        }

        @Override
        public Mono<AccessToken> refreshAccessToken(String clientId, String refreshToken) {
            return Mono.empty();
        }

        @Override
        public Mono<Void> removeToken(String clientId, String token) {
            return Mono.empty();
        }

        @Override
        public Mono<Void> cancelGrant(String clientId, String userId) {
            return Mono.empty();
        }
    }

    /** In-memory store that round-trips the authorization-code cache through Java serialization. */
    private static final class SerializedStore {
        private final ConcurrentMap<String, byte[]> values = new ConcurrentHashMap<>();

        @SuppressWarnings("unchecked")
        ReactiveRedisOperations<String, AuthorizationCodeCache> operations() {
            Object valueOperations = Proxy.newProxyInstance(
                Harness.class.getClassLoader(),
                new Class<?>[]{ReactiveValueOperations.class},
                (proxy, method, arguments) -> {
                    if (isObjectMethod(method)) {
                        return objectMethod(proxy, method, arguments, "value-operations");
                    }
                    switch (method.getName()) {
                        case "set":
                            values.put((String) arguments[0], serialize(arguments[1]));
                            return Mono.just(true);
                        case "get":
                            byte[] bytes = values.get((String) arguments[0]);
                            return bytes == null ? Mono.empty() : Mono.just(deserialize(bytes));
                        case "delete":
                            return Mono.just(values.remove((String) arguments[0]) != null);
                        default:
                            throw new UnsupportedOperationException(method.toGenericString());
                    }
                });
            return (ReactiveRedisOperations<String, AuthorizationCodeCache>) Proxy.newProxyInstance(
                Harness.class.getClassLoader(),
                new Class<?>[]{ReactiveRedisOperations.class},
                (proxy, method, arguments) -> {
                    if (isObjectMethod(method)) {
                        return objectMethod(proxy, method, arguments, "redis-operations");
                    }
                    if ("opsForValue".equals(method.getName())) {
                        return valueOperations;
                    }
                    throw new UnsupportedOperationException(method.toGenericString());
                });
        }

        private static byte[] serialize(Object value) {
            try {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try (ObjectOutputStream stream = new ObjectOutputStream(out)) {
                    stream.writeObject(value);
                }
                return out.toByteArray();
            } catch (Exception e) {
                throw new IllegalStateException("cannot serialize the authorization code", e);
            }
        }

        private static Object deserialize(byte[] bytes) {
            try (ObjectInputStream stream = new ObjectInputStream(new ByteArrayInputStream(bytes))) {
                return stream.readObject();
            } catch (Exception e) {
                throw new IllegalStateException("cannot deserialize the authorization code", e);
            }
        }

        private static boolean isObjectMethod(Method method) {
            return method.getDeclaringClass() == Object.class;
        }

        private static Object objectMethod(Object proxy, Method method, Object[] arguments, String name) {
            switch (method.getName()) {
                case "toString":
                    return name;
                case "hashCode":
                    return System.identityHashCode(proxy);
                case "equals":
                    return proxy == arguments[0];
                default:
                    return null;
            }
        }
    }

    /**
     * Mirrors the product's business-exception mapping: a business exception with an HTTP status
     * keeps it, anything that is a clean rejection becomes a 400. Unhandled runtime failures are
     * deliberately not converted, so a crash is not mistaken for a refusal.
     */
    @RestControllerAdvice
    public static final class RefusalAdvice {
        @ExceptionHandler(BusinessException.class)
        public ResponseEntity<Map<String, Object>> business(BusinessException error) {
            int status = error.getStatus();
            if (status < 400 || status > 599) {
                status = 400;
            }
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("code", error.getCode());
            return ResponseEntity.status(status).body(body);
        }

        @ExceptionHandler({IllegalArgumentException.class, UnsupportedOperationException.class})
        public ResponseEntity<Map<String, Object>> rejected(RuntimeException error) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("message", String.valueOf(error.getMessage()));
            return ResponseEntity.badRequest().body(body);
        }
    }
}
