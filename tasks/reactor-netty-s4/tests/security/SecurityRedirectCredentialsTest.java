package hidden;

import java.time.Duration;

import io.netty.handler.codec.http.cookie.DefaultCookie;
import org.junit.jupiter.api.Test;
import reactor.netty.Connection;

import static hidden.TestSupport.AUTHORIZATION;
import static hidden.TestSupport.COOKIE;
import static hidden.TestSupport.client;
import static hidden.TestSupport.timeout;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * A credential or cookie supplied by the application must not be delivered to a redirect
 * destination that is less protected than the destination it was supplied for.
 */
class SecurityRedirectCredentialsTest {

	private static final String SECRET = "Bearer hidden-marker-4f1c";

	@Test
	void downgradeDoesNotForwardAuthorization() throws Exception {
		try (TestSupport.DualServer server = new TestSupport.DualServer()) {
			int port = server.port();
			server.redirect("/start", "http://localhost:" + port + "/next");

			client().headers(h -> h.add(AUTHORIZATION, SECRET))
			        .get()
			        .uri("https://localhost:" + port + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(server.hits("/start")).isPositive();
			assertThat(server.header("/start", AUTHORIZATION)).isEqualTo(SECRET);
			assertThat(server.header("/next", AUTHORIZATION)).isNull();
		}
	}

	@Test
	void downgradeDoesNotForwardConfiguredCookie() throws Exception {
		try (TestSupport.DualServer server = new TestSupport.DualServer()) {
			int port = server.port();
			server.redirect("/start", "http://localhost:" + port + "/next");

			client().cookie(new DefaultCookie("session", "hidden-cookie-4f1c"))
			        .get()
			        .uri("https://localhost:" + port + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(server.header("/start", COOKIE)).contains("session=hidden-cookie-4f1c");
			assertThat(server.header("/next", COOKIE)).isNull();
		}
	}

	@Test
	void crossOriginDoesNotForwardConfiguredCookie() throws Exception {
		try (TestSupport.Recorder target = new TestSupport.Recorder("127.0.0.1");
				TestSupport.Recorder origin = new TestSupport.Recorder("localhost", true)) {
			origin.redirect("/start", "http://127.0.0.1:" + target.port() + "/next");

			client().cookie(new DefaultCookie("session", "hidden-cookie-4f1c"))
			        .get()
			        .uri("http://localhost:" + origin.port() + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(origin.header("/start", COOKIE)).contains("session=hidden-cookie-4f1c");
			assertThat(target.hits("/next")).isPositive();
			assertThat(target.header("/next", COOKIE)).isNull();
		}
	}

	@Test
	void websocketRedirectDoesNotForwardAuthorization() throws Exception {
		try (TestSupport.Recorder target = new TestSupport.Recorder("127.0.0.1");
				TestSupport.Recorder origin = new TestSupport.Recorder("localhost", true)) {
			origin.redirect("/socket", "http://127.0.0.1:" + target.port() + "/socket");

			try {
				Connection connection = client().headers(h -> h.add(AUTHORIZATION, SECRET))
				        .websocket()
				        .uri("ws://localhost:" + origin.port() + "/socket")
				        .connect()
				        .block(Duration.ofSeconds(20));
				if (connection != null) {
					connection.disposeNow();
				}
			}
			catch (RuntimeException e) {
				TestSupport.ignore(e);
			}

			assertThat(target.hits("/socket")).isPositive();
			assertThat(target.header("/socket", AUTHORIZATION)).isNull();
		}
	}

	@Test
	void websocketDowngradeDoesNotForwardAuthorization() throws Exception {
		try (TestSupport.DualServer server = new TestSupport.DualServer()) {
			int port = server.port();
			server.redirect("/socket", "ws://localhost:" + port + "/next");

			try {
				Connection connection = client().headers(h -> h.add(AUTHORIZATION, SECRET))
				        .websocket()
				        .uri("wss://localhost:" + port + "/socket")
				        .connect()
				        .block(Duration.ofSeconds(20));
				if (connection != null) {
					connection.disposeNow();
				}
			}
			catch (RuntimeException e) {
				TestSupport.ignore(e);
			}

			assertThat(server.hits("/next")).isPositive();
			assertThat(server.header("/socket", AUTHORIZATION)).isEqualTo(SECRET);
			assertThat(server.header("/next", AUTHORIZATION)).isNull();
		}
	}

	@Test
	void differentPortDoesNotForwardAuthorization() throws Exception {
		try (TestSupport.Recorder target = new TestSupport.Recorder("localhost");
				TestSupport.Recorder origin = new TestSupport.Recorder("localhost", true)) {
			origin.redirect("/start", "http://localhost:" + target.port() + "/next");

			client().headers(h -> h.add(AUTHORIZATION, SECRET))
			        .get()
			        .uri("http://localhost:" + origin.port() + "/start")
			        .responseContent()
			        .aggregate()
			        .asString()
			        .block(timeout());

			assertThat(origin.header("/start", AUTHORIZATION)).isEqualTo(SECRET);
			assertThat(target.hits("/next")).isPositive();
			assertThat(target.header("/next", AUTHORIZATION)).isNull();
		}
	}
}
