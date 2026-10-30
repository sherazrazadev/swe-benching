package hidden;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelPipeline;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.codec.ByteToMessageDecoder;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpHeaders;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.codec.http.QueryStringDecoder;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.ssl.SslHandler;
import io.netty.handler.ssl.util.InsecureTrustManagerFactory;
import io.netty.handler.ssl.util.SelfSignedCertificate;
import reactor.core.publisher.Mono;
import reactor.netty.DisposableServer;
import reactor.netty.http.Http11SslContextSpec;
import reactor.netty.http.server.HttpServer;
import reactor.netty.resources.ConnectionProvider;
import reactor.netty.http.client.HttpClient;
import reactor.netty.tcp.TcpServer;

/**
 * Test fixtures for the redirect credential suites. Everything here is a plain peer: a client
 * that follows redirects, servers that record the request headers they receive, and one server
 * that speaks both plaintext and TLS on the same port so a protocol downgrade can be observed.
 */
final class TestSupport {

	static final String AUTHORIZATION = "Authorization";
	static final String COOKIE = "Cookie";

	private TestSupport() {
	}

	/** An HTTP client that never reuses a connection and trusts any test certificate. */
	static HttpClient client() {
		Http11SslContextSpec spec = Http11SslContextSpec.forClient()
				.configure(b -> b.trustManager(InsecureTrustManagerFactory.INSTANCE));
		return HttpClient.create(ConnectionProvider.newConnection())
		                 .followRedirect(true)
		                 .secure(s -> s.sslContext(spec));
	}

	/** A server that records every request it receives, keyed by path. */
	static final class Recorder implements AutoCloseable {
		private final Map<String, CopyOnWriteArrayList<HttpHeaders>> requests = new ConcurrentHashMap<>();
		private final Map<String, String> redirects = new ConcurrentHashMap<>();
		private final DisposableServer server;

		Recorder(String host, boolean redirecting) {
			server = HttpServer.create()
					.port(0)
					.host(host)
					.handle((req, res) -> {
						record(req);
						String target = redirects.get(new QueryStringDecoder(req.uri()).path());
						if (redirecting && target != null) {
							return res.status(HttpResponseStatus.FOUND)
							          .header(HttpHeaderNames.LOCATION, target)
							          .send();
						}
						return res.sendString(Mono.just("ok"));
					})
					.bindNow();
		}

		Recorder(String host) {
			this(host, false);
		}

		int port() {
			return server.port();
		}

		void redirect(String from, String to) {
			redirects.put(from, to);
		}

		private void record(reactor.netty.http.server.HttpServerRequest req) {
			String p = new QueryStringDecoder(req.uri()).path();
			requests.computeIfAbsent(p, k -> new CopyOnWriteArrayList<>()).add(req.requestHeaders().copy());
		}

		/** Number of requests received for a path. */
		int hits(String path) {
			List<HttpHeaders> list = requests.get(path);
			return list == null ? 0 : list.size();
		}

		/** The value of a header on the first request for a path, or null. */
		String header(String path, String name) {
			List<HttpHeaders> list = requests.get(path);
			return list == null || list.isEmpty() ? null : list.get(0).get(name);
		}

		@Override
		public void close() {
			server.disposeNow();
		}
	}

	/**
	 * A server that accepts both a TLS connection and a plaintext connection on the same
	 * host and port, decides from the first bytes which one it is, and records the request
	 * headers it receives for each path.
	 */
	static final class DualServer implements AutoCloseable {
		private final SelfSignedCertificate certificate;
		private final SslContext serverContext;
		private final Map<String, CopyOnWriteArrayList<HttpHeaders>> requests = new ConcurrentHashMap<>();
		private final Map<String, String> redirects = new ConcurrentHashMap<>();
		private final DisposableServer server;

		DualServer() throws Exception {
			certificate = new SelfSignedCertificate();
			serverContext = SslContextBuilder.forServer(certificate.certificate(), certificate.privateKey()).build();
			server = TcpServer.create()
					.port(0)
					.doOnChannelInit((observer, channel, address) ->
							channel.pipeline().addFirst("probe", new Detector(this)))
					.doOnConnection(connection -> connection.channel().read())
					.bindNow();
		}

		int port() {
			return server.port();
		}

		void redirect(String from, String to) {
			redirects.put(from, to);
		}

		String header(String path, String name) {
			List<HttpHeaders> list = requests.get(path);
			return list == null || list.isEmpty() ? null : list.get(0).get(name);
		}

		int hits(String path) {
			List<HttpHeaders> list = requests.get(path);
			return list == null ? 0 : list.size();
		}

		void record(String path, HttpHeaders headers) {
			requests.computeIfAbsent(path, k -> new CopyOnWriteArrayList<>()).add(headers.copy());
		}

		String location(String path) {
			return redirects.get(path);
		}

		@Override
		public void close() {
			server.disposeNow();
			certificate.delete();
		}

		private static final class Detector extends ByteToMessageDecoder {
			private final DualServer owner;

			Detector(DualServer owner) {
				this.owner = owner;
			}

			@Override
			protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) {
				if (in.readableBytes() < 5) {
					return;
				}
				ByteBuf first = Unpooled.copiedBuffer(in);
				in.skipBytes(in.readableBytes());
				ChannelPipeline pipeline = ctx.pipeline();
				boolean tls = SslHandler.isEncrypted(first, false);
				pipeline.addAfter("probe", "codec", new HttpServerCodec());
				pipeline.addAfter("codec", "aggregator", new HttpObjectAggregator(8192));
				pipeline.addAfter("aggregator", "recorder", new Handler(owner));
				if (tls) {
					pipeline.addFirst("ssl", owner.serverContext.newHandler(ctx.alloc()));
				}
				pipeline.remove(this);
				pipeline.fireChannelRead(first);
			}
		}

		private static final class Handler extends SimpleChannelInboundHandler<FullHttpRequest> {
			private final DualServer owner;

			Handler(DualServer owner) {
				this.owner = owner;
			}

			@Override
			protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest req) throws Exception {
				String path = new QueryStringDecoder(req.uri()).path();
				owner.record(path, req.headers());
				String location = owner.location(path);
				FullHttpResponse response;
				if (location != null) {
					response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.FOUND);
					response.headers().set(HttpHeaderNames.LOCATION, location)
					        .set(HttpHeaderNames.CONTENT_LENGTH, 0);
				}
				else if (isWebsocketHandshake(req)) {
					response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.SWITCHING_PROTOCOLS);
					response.headers().set(HttpHeaderNames.UPGRADE, "websocket");
					response.headers().set(HttpHeaderNames.CONNECTION, "Upgrade");
					response.headers().set("Sec-WebSocket-Accept", accept(req.headers().get("Sec-WebSocket-Key")));
				}
				else {
					response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.OK,
							Unpooled.copiedBuffer("ok", StandardCharsets.UTF_8));
					response.headers().set(HttpHeaderNames.CONTENT_LENGTH, response.content().readableBytes());
				}
				ctx.writeAndFlush(response);
			}

			@Override
			public boolean acceptInboundMessage(Object msg) {
				return msg instanceof FullHttpRequest;
			}

			private static boolean isWebsocketHandshake(FullHttpRequest req) {
				return req.headers().contains(HttpHeaderNames.UPGRADE) &&
						req.headers().get(HttpHeaderNames.UPGRADE).toLowerCase().contains("websocket");
			}

			private static String accept(String key) throws Exception {
				MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
				byte[] digest = sha1.digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
						.getBytes(StandardCharsets.ISO_8859_1));
				return Base64.getEncoder().encodeToString(digest);
			}
		}
	}

	static Duration timeout() {
		return Duration.ofSeconds(20);
	}

	static void dispose(AutoCloseable... closeables) {
		for (AutoCloseable c : closeables) {
			if (c == null) {
				continue;
			}
			try {
				c.close();
			}
			catch (Exception e) {
				// best effort
			}
		}
	}

	static void ignore(Throwable t) {
		// A websocket handshake against a recorder that answers a plain HTTP response fails on
		// the client; the request the client sent is what the test observes.
	}

}
