package hidden;

import java.time.Duration;

import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.cookie.DefaultCookie;
import org.junit.jupiter.api.Test;
import reactor.netty.Connection;

import static hidden.TestSupport.AUTHORIZATION;
import static hidden.TestSupport.COOKIE;
import static hidden.TestSupport.client;
import static hidden.TestSupport.timeout;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * The everyday redirect flows that must keep working: credentials survive a redirect that does
 * not lower the protection of the destination, and a redirect request the application dresses
 * explicitly still carries what it asks for.
 */
class FunctionalRedirectCredentialsTest {

	private static final String SECRET = "Bearer hidden-marker-7a2d";

	@Test
	void sameOriginRedirectKeepsCredentials() throws Exception {
		try (TestSupport.Recorder server = new TestSupport.Recorder("localhost", true)) {
			server.redirect("/start", "/next");

			client().headers(h -> h.add(AUTHORIZATION, SECRET))
			        .cookie(new DefaultCookie("session", "hidden-cookie-7a2d"))
			        .get()
			        .uri("http://localhost:" + server.port() + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(server.header("/next", AUTHORIZATION)).isEqualTo(SECRET);
			assertThat(server.header("/next", COOKIE)).contains("session=hidden-cookie-7a2d");
		}
	}

	@Test
	void upgradeRedirectKeepsCredentials() throws Exception {
		try (TestSupport.DualServer server = new TestSupport.DualServer()) {
			int port = server.port();
			server.redirect("/start", "https://localhost:" + port + "/next");

			client().headers(h -> h.add(AUTHORIZATION, SECRET))
			        .cookie(new DefaultCookie("session", "hidden-cookie-7a2d"))
			        .get()
			        .uri("http://localhost:" + port + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(server.header("/next", AUTHORIZATION)).isEqualTo(SECRET);
			assertThat(server.header("/next", COOKIE)).contains("session=hidden-cookie-7a2d");
		}
	}

	@Test
	void crossOriginRedirectStripsCredentials() throws Exception {
		try (TestSupport.Recorder target = new TestSupport.Recorder("127.0.0.1");
				TestSupport.Recorder origin = new TestSupport.Recorder("localhost", true)) {
			origin.redirect("/start", "http://127.0.0.1:" + target.port() + "/next");

			client().headers(h -> h.add(AUTHORIZATION, SECRET))
			        .cookie(new DefaultCookie("session", "hidden-cookie-7a2d"))
			        .get()
			        .uri("http://localhost:" + origin.port() + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(target.hits("/next")).isPositive();
			assertThat(target.header("/next", AUTHORIZATION)).isNull();
		}
	}

	@Test
	void websocketHandshakeKeepsCredentials() throws Exception {
		try (TestSupport.DualServer server = new TestSupport.DualServer()) {
			int port = server.port();

			Connection connection = client().headers(h -> h.add(AUTHORIZATION, SECRET))
			        .websocket()
			        .uri("ws://localhost:" + port + "/socket")
			        .connect()
			        .block(Duration.ofSeconds(20));
			try {
				assertThat(server.header("/socket", AUTHORIZATION)).isEqualTo(SECRET);
			}
			finally {
				if (connection != null) {
					connection.disposeNow();
				}
			}
		}
	}

	@Test
	void redirectRequestConsumerCanAddACookie() throws Exception {
		try (TestSupport.Recorder server = new TestSupport.Recorder("localhost", true)) {
			server.redirect("/start", "/next");

			client().followRedirect((req, res) -> res.status().equals(HttpResponseStatus.FOUND),
			                        (request, redirect) ->
			                                redirect.addCookie(new DefaultCookie("session", "added-on-redirect")))
			        .get()
			        .uri("http://localhost:" + server.port() + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(server.header("/next", COOKIE)).contains("session=added-on-redirect");
		}
	}
}
