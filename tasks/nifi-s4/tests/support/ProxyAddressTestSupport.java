/*
 * Test harness for the web connector: starts the project's real Jetty connector with the real
 * logout-complete redirect filter, sends HTTP(S) requests, and reports the absolute redirect URL.
 */
package org.apache.nifi.web.server;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServlet;
import org.apache.nifi.security.cert.builder.StandardCertificateBuilder;
import org.apache.nifi.security.ssl.EphemeralKeyStoreBuilder;
import org.apache.nifi.security.ssl.StandardSslContextBuilder;
import org.apache.nifi.util.NiFiProperties;
import org.apache.nifi.web.server.filter.LogoutCompleteRedirectFilter;
import org.eclipse.jetty.ee11.servlet.FilterHolder;
import org.eclipse.jetty.ee11.servlet.ServletContextHandler;
import org.eclipse.jetty.ee11.servlet.ServletHolder;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.junit.jupiter.api.Assertions;

import javax.net.ssl.SSLContext;
import javax.security.auth.x500.X500Principal;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.EnumSet;
import java.util.List;
import java.util.Properties;

final class ProxyAddressTestSupport {
    private static final String ALLOW_RESTRICTED_HEADERS_PROPERTY =
            "jdk.httpclient.allowRestrictedHeaders";

    static {
        // The project's own connector test sets a Host header. HttpClient reads this property once,
        // at class initialisation, so it has to be in place before any client is created.
        System.setProperty(ALLOW_RESTRICTED_HEADERS_PROPERTY, "host,Host");
    }

    static final String ALLOWED_HOST = "nifi.example.org";

    static final String ALLOWED_HOST_WITH_PORT = "nifi.staged.example.org";

    static final int ALLOWED_PUBLIC_PORT = 8443;

    static final String ATTACKER_HOST = "attacker.invalid";

    static final int ATTACKER_PORT = 6666;

    static final String ALLOWED_ADDRESS_PROPERTY =
            ALLOWED_HOST + ":" + ALLOWED_PUBLIC_PORT + ", " + ALLOWED_HOST_WITH_PORT;

    static final String LOGOUT_COMPLETE_PATH = "/nifi/logout-complete";

    private static final String HOST_HEADER = "Host";

    private static final String LOCALHOST_NAME = "localhost";

    private static final SSLContext SSL_CONTEXT = createSslContext();

    private ProxyAddressTestSupport() {
    }

    static Fixture startHttps() throws Exception {
        return start(true);
    }

    static Fixture startHttp() throws Exception {
        return start(false);
    }

    private static Fixture start(final boolean https) throws Exception {
        final Properties applicationProperties = new Properties();
        applicationProperties.setProperty(
                https ? NiFiProperties.WEB_HTTPS_PORT : NiFiProperties.WEB_HTTP_PORT, "0");
        applicationProperties.setProperty(NiFiProperties.WEB_PROXY_HOST, ALLOWED_ADDRESS_PROPERTY);

        final NiFiProperties properties =
                NiFiProperties.createBasicNiFiProperties((String) null, applicationProperties);

        // Use the product's own server wiring (connectors, handlers, request log) and add the real
        // logout-complete redirect filter as a servlet context in the standard handler chain.
        final StandardServerProvider serverProvider =
                new StandardServerProvider(https ? SSL_CONTEXT : null);
        final Server server = serverProvider.getServer(properties);

        final ServletContextHandler context = new ServletContextHandler();
        context.addFilter(new FilterHolder(new LogoutCompleteRedirectFilter()), "/*",
                EnumSet.of(DispatcherType.REQUEST));
        context.addServlet(new ServletHolder(new HttpServlet() {
        }), "/*");
        final Handler.Collection handlers = (Handler.Collection) server.getHandler();
        handlers.addHandler(context);

        server.start();
        final ServerConnector connector = (ServerConnector) server.getConnectors()[0];
        return new Fixture(server, connector, https);
    }

    static Response get(final Fixture fixture, final String... headers) throws IOException, InterruptedException {
        final HttpRequest.Builder requestBuilder =
                HttpRequest.newBuilder(fixture.uri()).version(HttpClient.Version.HTTP_1_1);
        for (int index = 0; index + 1 < headers.length; index += 2) {
            requestBuilder.header(headers[index], headers[index + 1]);
        }

        final HttpResponse<String> response =
                fixture.client().send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
        final String location = response.headers().firstValue("Location").orElse("");
        return new Response(response.statusCode(), location, response.body());
    }

    static Response getWithHost(final Fixture fixture, final String host, final String... headers)
            throws IOException, InterruptedException {
        final String[] allHeaders = new String[headers.length + 2];
        allHeaders[0] = HOST_HEADER;
        allHeaders[1] = host;
        System.arraycopy(headers, 0, allHeaders, 2, headers.length);
        return get(fixture, allHeaders);
    }

    /**
     * The attack is blocked when the response is not a server error and nowhere advertises the
     * attacker-supplied address. A refusal (any client error) and a request served with a safe
     * address both satisfy the property.
     */
    static void assertAddressNotAdvertised(final Response response, final String attackerValue) {
        Assertions.assertTrue(response.status() < 500,
                "the application returned a server error: " + response.status());
        Assertions.assertFalse(response.location().contains(attackerValue),
                "the redirect advertises the attacker value: " + response.location());
        Assertions.assertFalse(response.body().contains(attackerValue),
                "the response body advertises the attacker value");
    }

    static void assertAddressAdvertised(final Response response, final String expectedHost,
                                        final Integer expectedPort) {
        Assertions.assertEquals(302, response.status(),
                "a legitimate proxy address must still produce the redirect");
        final URI location = URI.create(response.location());
        Assertions.assertEquals(expectedHost, location.getHost(),
                "the redirect must name the allowed host: " + response.location());
        if (expectedPort != null) {
            Assertions.assertEquals(expectedPort.intValue(), location.getPort(),
                    "the redirect must name the allowed port: " + response.location());
        }
    }

    private static SSLContext createSslContext() {
        try {
            final KeyPair keyPair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
            final X509Certificate certificate =
                    new StandardCertificateBuilder(keyPair, new X500Principal("CN=" + LOCALHOST_NAME),
                                    Duration.ofHours(1))
                            .setDnsSubjectAlternativeNames(
                                    List.of(LOCALHOST_NAME, ALLOWED_HOST, ALLOWED_HOST_WITH_PORT))
                            .build();
            final KeyStore keyStore = new EphemeralKeyStoreBuilder().build();
            keyStore.setKeyEntry("entry-0", keyPair.getPrivate(), new char[0],
                    new Certificate[]{certificate});
            return new StandardSslContextBuilder()
                    .keyStore(keyStore)
                    .trustStore(keyStore)
                    .keyPassword(new char[0])
                    .build();
        } catch (final Exception e) {
            throw new IllegalStateException("SSL context construction failed", e);
        }
    }

    static final class Fixture implements AutoCloseable {
        private final Server server;

        private final ServerConnector connector;

        private final boolean https;

        private final HttpClient client;

        private Fixture(final Server server, final ServerConnector connector, final boolean https) {
            this.server = server;
            this.connector = connector;
            this.https = https;
            final HttpClient.Builder builder = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(15))
                    .version(HttpClient.Version.HTTP_1_1);
            if (https) {
                builder.sslContext(SSL_CONTEXT);
            }
            this.client = builder.build();
        }

        URI uri() {
            return URI.create((https ? "https" : "http") + "://" + LOCALHOST_NAME + ":"
                    + connector.getLocalPort() + LOGOUT_COMPLETE_PATH);
        }

        HttpClient client() {
            return client;
        }

        int localPort() {
            return connector.getLocalPort();
        }

        @Override
        public void close() throws Exception {
            server.stop();
        }
    }

    record Response(int status, String location, String body) {
    }
}
