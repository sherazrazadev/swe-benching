/*
 * Copyright 2026 The Netty Project
 *
 * The Netty Project licenses this file to you under the Apache License,
 * version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at:
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
package io.netty.handler.ssl.ocsp;

import io.netty.bootstrap.Bootstrap;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.Unpooled;
import io.netty.channel.Channel;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.MultiThreadIoEventLoopGroup;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioIoHandler;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioDatagramChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.channel.socket.nio.NioSocketChannel;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import io.netty.handler.ssl.SslHandshakeCompletionEvent;
import io.netty.pkitesting.CertificateBuilder;
import io.netty.pkitesting.X509Bundle;
import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.DEROctetString;
import org.bouncycastle.asn1.nist.NISTObjectIdentifiers;
import org.bouncycastle.asn1.ocsp.OCSPResponse;
import org.bouncycastle.asn1.ocsp.OCSPResponseStatus;
import org.bouncycastle.asn1.ocsp.ResponseBytes;
import org.bouncycastle.asn1.x509.AccessDescription;
import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.asn1.x509.AuthorityInformationAccess;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.bouncycastle.cert.ocsp.BasicOCSPResp;
import org.bouncycastle.cert.ocsp.BasicOCSPRespBuilder;
import org.bouncycastle.cert.ocsp.CertificateID;
import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.bouncycastle.cert.ocsp.OCSPRespBuilder;
import org.bouncycastle.cert.ocsp.RespID;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.DigestCalculator;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;

import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.cert.X509Certificate;
import java.util.Date;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Shared fixtures for the hidden OCSP suites. Everything runs on loopback: a local TLS server
 * presents a generated certificate chain and a local HTTP responder serves the OCSP answer.
 */
final class OcspTestSupport {

    private static final AtomicLong SERIALS = new AtomicLong(1000);
    private static X509Bundle root;
    private static X509Bundle issuer;
    private static X509Bundle rogueIssuer;
    private static X509Bundle delegatedResponder;
    private static KeyPair leafKeyPair;

    static synchronized X509Bundle root() throws Exception {
        if (root == null) {
            root = new CertificateBuilder().algorithm(CertificateBuilder.Algorithm.rsa2048)
                    .subject("CN=Hidden Test Root CA").setIsCertificateAuthority(true).buildSelfSigned();
        }
        return root;
    }

    static synchronized X509Bundle issuer() throws Exception {
        if (issuer == null) {
            issuer = new CertificateBuilder().algorithm(CertificateBuilder.Algorithm.rsa2048)
                    .subject("CN=Hidden Test Issuing CA").setIsCertificateAuthority(true)
                    .buildIssuedBy(root());
        }
        return issuer;
    }

    static synchronized X509Bundle rogueIssuer() throws Exception {
        if (rogueIssuer == null) {
            rogueIssuer = new CertificateBuilder().algorithm(CertificateBuilder.Algorithm.rsa2048)
                    .subject("CN=Unrelated Issuing CA").setIsCertificateAuthority(true)
                    .buildIssuedBy(root());
        }
        return rogueIssuer;
    }

    static synchronized X509Bundle delegatedResponder() throws Exception {
        if (delegatedResponder == null) {
            delegatedResponder = new CertificateBuilder().algorithm(CertificateBuilder.Algorithm.rsa2048)
                    .subject("CN=Hidden Test Delegated Responder")
                    .addExtendedKeyUsageOcspSigning()
                    .buildIssuedBy(issuer());
        }
        return delegatedResponder;
    }

    private static synchronized KeyPair leafKeyPair() throws Exception {
        if (leafKeyPair == null) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            leafKeyPair = generator.generateKeyPair();
        }
        return leafKeyPair;
    }

    /** A server certificate issued by the test issuer, pointing at the given responder port. */
    static X509Bundle leaf(int responderPort) throws Exception {
        return leafWithSerial(issuer(), BigInteger.valueOf(SERIALS.incrementAndGet()), responderPort);
    }

    static X509Bundle leafWithSerial(X509Bundle issuerBundle, BigInteger serial, int responderPort)
            throws Exception {
        String uri = "http://127.0.0.1:" + responderPort + "/ocsp";
        AuthorityInformationAccess aia = new AuthorityInformationAccess(
                new AccessDescription(AccessDescription.id_ad_ocsp,
                        new GeneralName(GeneralName.uniformResourceIdentifier, uri)));
        return new CertificateBuilder().algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=Hidden Test Server " + serial)
                .serial(serial)
                .keyPair(leafKeyPair())
                .addSanIpAddress("127.0.0.1")
                .addExtendedKeyUsageServerAuth()
                .addExtensionOctetString(Extension.authorityInfoAccess.getId(), false, aia.getEncoded())
                .buildIssuedBy(issuerBundle);
    }

    static CertificateID certificateId(X509Certificate issuingCertificate, BigInteger serial, boolean sha256)
            throws Exception {
        AlgorithmIdentifier algorithm = sha256
                ? new AlgorithmIdentifier(NISTObjectIdentifiers.id_sha256)
                : CertificateID.HASH_SHA1;
        DigestCalculator calculator = new JcaDigestCalculatorProviderBuilder().build().get(algorithm);
        return new CertificateID(calculator, new JcaX509CertificateHolder(issuingCertificate), serial);
    }

    /** An OCSP answer for the certificate with the given identifier, signed by {@code signer}. */
    static BasicOCSPResp basicResponse(CertificateID certificateId, CertificateStatus status,
                                       X509Bundle signer, X509CertificateHolder[] chain, X509Bundle responderId)
            throws Exception {
        BasicOCSPRespBuilder builder = new BasicOCSPRespBuilder(
                new RespID(new JcaX509CertificateHolder(responderId.getCertificate()).getSubject()));
        Date now = new Date();
        builder.addResponse(certificateId, status, new Date(now.getTime() - 3_600_000L),
                new Date(now.getTime() + 86_400_000L));
        ContentSigner contentSigner = new JcaContentSignerBuilder("SHA256withRSA")
                .build(signer.getKeyPair().getPrivate());
        return builder.build(contentSigner, chain, now);
    }

    /** A basic answer for the given certificate, signed by the test issuer itself. */
    static byte[] answerFor(X509Bundle certificate, boolean sha256) throws Exception {
        return answerFor(certificate, CertificateStatus.GOOD, sha256);
    }

    static byte[] answerFor(X509Bundle certificate, CertificateStatus status, boolean sha256) throws Exception {
        X509Bundle issuerBundle = issuer();
        CertificateID id = certificateId(issuerBundle.getCertificate(),
                certificate.getCertificate().getSerialNumber(), sha256);
        return encode(basicResponse(id, status, issuerBundle, null, issuerBundle));
    }

    /** A basic answer signed by a responder that the issuer delegated signing authority to. */
    static byte[] answerFromDelegatedResponder(X509Bundle certificate) throws Exception {
        X509Bundle issuerBundle = issuer();
        X509Bundle responder = delegatedResponder();
        CertificateID id = certificateId(issuerBundle.getCertificate(),
                certificate.getCertificate().getSerialNumber(), false);
        X509CertificateHolder[] chain = { holder(responder), holder(issuerBundle) };
        return encode(basicResponse(id, CertificateStatus.GOOD, responder, chain, responder));
    }

    /** An answer that carries two entries instead of the one that was asked for. */
    static byte[] answerWithTwoEntries(X509Bundle first, X509Bundle second) throws Exception {
        X509Bundle issuerBundle = issuer();
        BasicOCSPRespBuilder builder = new BasicOCSPRespBuilder(
                new RespID(new JcaX509CertificateHolder(issuerBundle.getCertificate()).getSubject()));
        Date now = new Date();
        Date thisUpdate = new Date(now.getTime() - 3_600_000L);
        Date nextUpdate = new Date(now.getTime() + 86_400_000L);
        builder.addResponse(certificateId(issuerBundle.getCertificate(),
                first.getCertificate().getSerialNumber(), false), CertificateStatus.GOOD,
                thisUpdate, nextUpdate);
        builder.addResponse(certificateId(issuerBundle.getCertificate(),
                second.getCertificate().getSerialNumber(), false), CertificateStatus.GOOD,
                thisUpdate, nextUpdate);
        ContentSigner contentSigner = new JcaContentSignerBuilder("SHA256withRSA")
                .build(issuerBundle.getKeyPair().getPrivate());
        return encode(builder.build(contentSigner, null, now));
    }

    /** An answer whose identifier was computed for a different issuing certificate, same serial. */
    static byte[] answerNamingAnotherIssuer(X509Bundle certificate) throws Exception {
        X509Bundle issuerBundle = issuer();
        CertificateID id = certificateId(rogueIssuer().getCertificate(),
                certificate.getCertificate().getSerialNumber(), false);
        return encode(basicResponse(id, CertificateStatus.GOOD, issuerBundle, null, issuerBundle));
    }

    static byte[] encode(BasicOCSPResp response) throws Exception {
        return new OCSPRespBuilder().build(OCSPRespBuilder.SUCCESSFUL, response).getEncoded();
    }

    /** A response whose response object is not a basic OCSP response. */
    static byte[] responseWithUnknownObject() throws Exception {
        ResponseBytes bytes = new ResponseBytes(new ASN1ObjectIdentifier("1.2.3.4.5"),
                new DEROctetString(new byte[]{ 0x30, 0x00 }));
        return new OCSPResponse(new OCSPResponseStatus(OCSPResponseStatus.SUCCESSFUL), bytes).getEncoded();
    }

    /** A response that carries no successful answer at all. */
    static byte[] unsuccessfulResponse() throws Exception {
        return new OCSPResponse(new OCSPResponseStatus(OCSPResponseStatus.UNAUTHORIZED), null).getEncoded();
    }

    /** The peer chain as the TLS client sees it: leaf first, then its issuer. */
    static X509Certificate[] peerChain(X509Bundle leaf) throws Exception {
        return new X509Certificate[]{ leaf.getCertificate(), issuer().getCertificate() };
    }

    static X509CertificateHolder holder(X509Bundle bundle) throws Exception {
        return new JcaX509CertificateHolder(bundle.getCertificate());
    }

    static final class Responder implements AutoCloseable {
        // Every responder in the JVM gets a port that no earlier responder used, so a response kept
        // for one responder can never be observed under another test's responder URL.
        private static final Set<Integer> USED_PORTS = ConcurrentHashMap.newKeySet();

        private final EventLoopGroup group = new MultiThreadIoEventLoopGroup(1, NioIoHandler.newFactory());
        private final Channel channel;
        private final int port;
        private volatile byte[] body;

        Responder() throws Exception {
            ServerBootstrap bootstrap = new ServerBootstrap().group(group)
                    .channel(NioServerSocketChannel.class)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) {
                            ch.pipeline().addLast(new HttpServerCodec());
                            ch.pipeline().addLast(new HttpObjectAggregator(64 * 1024));
                            ch.pipeline().addLast(new SimpleChannelInboundHandler<FullHttpRequest>() {
                                @Override
                                protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest request) {
                                    byte[] payload = Responder.this.body;
                                    FullHttpResponse response = new DefaultFullHttpResponse(
                                            HttpVersion.HTTP_1_1, HttpResponseStatus.OK,
                                            Unpooled.wrappedBuffer(payload == null ? new byte[0] : payload));
                                    response.headers().set(HttpHeaderNames.CONTENT_TYPE,
                                            "application/ocsp-response");
                                    response.headers().setInt(HttpHeaderNames.CONTENT_LENGTH,
                                            response.content().readableBytes());
                                    ctx.writeAndFlush(response);
                                }
                            });
                        }
                    });
            Channel bound = null;
            int boundPort = -1;
            for (int attempt = 0; attempt < 200 && bound == null; attempt++) {
                Channel candidate = bootstrap.bind("127.0.0.1", 0).sync().channel();
                int candidatePort = ((InetSocketAddress) candidate.localAddress()).getPort();
                if (USED_PORTS.add(candidatePort)) {
                    bound = candidate;
                    boundPort = candidatePort;
                } else {
                    candidate.close().syncUninterruptibly();
                }
            }
            if (bound == null) {
                throw new IllegalStateException("could not allocate a fresh responder port");
            }
            channel = bound;
            port = boundPort;
        }

        int port() {
            return port;
        }

        void setBody(byte[] body) {
            this.body = body;
        }

        @Override
        public void close() {
            channel.close().syncUninterruptibly();
            group.shutdownGracefully().syncUninterruptibly();
        }
    }

    static final class TlsServer implements AutoCloseable {
        private final EventLoopGroup group = new MultiThreadIoEventLoopGroup(1, NioIoHandler.newFactory());
        private final Channel channel;
        private final int port;

        TlsServer(X509Bundle presented) throws Exception {
            SslContext context = SslContextBuilder.forServer(
                    presented.getKeyPair().getPrivate(), presented.getCertificatePath()).build();
            ServerBootstrap bootstrap = new ServerBootstrap().group(group)
                    .channel(NioServerSocketChannel.class)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) {
                            ch.pipeline().addLast(context.newHandler(ch.alloc()));
                        }
                    });
            channel = bootstrap.bind("127.0.0.1", 0).sync().channel();
            port = ((InetSocketAddress) channel.localAddress()).getPort();
        }

        int port() {
            return port;
        }

        @Override
        public void close() {
            channel.close().syncUninterruptibly();
            group.shutdownGracefully().syncUninterruptibly();
        }
    }

    static final class Recorder extends SimpleChannelInboundHandler<Object> {
        private final CountDownLatch latch = new CountDownLatch(1);
        volatile OcspResponse.Status status;
        volatile Throwable error;
        volatile boolean closed;

        @Override
        protected void channelRead0(ChannelHandlerContext ctx, Object msg) {
            // The suite only observes the validation outcome.
        }

        @Override
        public void userEventTriggered(ChannelHandlerContext ctx, Object evt) {
            if (evt instanceof OcspValidationEvent) {
                status = ((OcspValidationEvent) evt).response().status();
                latch.countDown();
            } else if (evt instanceof SslHandshakeCompletionEvent &&
                    !((SslHandshakeCompletionEvent) evt).isSuccess()) {
                error = ((SslHandshakeCompletionEvent) evt).cause();
                latch.countDown();
            }
            ctx.fireUserEventTriggered(evt);
        }

        @Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
            error = cause;
            latch.countDown();
        }

        @Override
        public void channelInactive(ChannelHandlerContext ctx) throws Exception {
            closed = true;
            latch.countDown();
            super.channelInactive(ctx);
        }

        boolean await(long seconds) throws InterruptedException {
            return latch.await(seconds, TimeUnit.SECONDS);
        }
    }

    static final class Result implements AutoCloseable {
        private final Channel channel;
        final OcspResponse.Status status;
        final Throwable error;
        final boolean closed;
        final boolean completed;

        Result(Channel channel, Recorder recorder, boolean completed) {
            this.channel = channel;
            this.status = recorder.status;
            this.error = recorder.error;
            this.closed = recorder.closed;
            this.completed = completed;
        }

        @Override
        public void close() {
            channel.close().syncUninterruptibly();
        }
    }

    static Result connect(X509Bundle trustRoot, int tlsPort, IoTransport transport) throws Exception {
        SslContext clientContext = SslContextBuilder.forClient()
                .trustManager(trustRoot.getCertificate()).build();
        Recorder recorder = new Recorder();
        Bootstrap bootstrap = new Bootstrap().group(transport.eventLoop())
                .channel(NioSocketChannel.class)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
                .handler(new ChannelInitializer<SocketChannel>() {
                    @Override
                    protected void initChannel(SocketChannel ch) {
                        ch.pipeline().addLast(clientContext.newHandler(ch.alloc(), "127.0.0.1", tlsPort));
                        ch.pipeline().addLast(new OcspServerCertificateValidator(false, transport));
                        ch.pipeline().addLast(recorder);
                    }
                });
        Channel channel = bootstrap.connect("127.0.0.1", tlsPort).sync().channel();
        boolean completed = recorder.await(30);
        return new Result(channel, recorder, completed);
    }

    /** Run one client handshake against a local TLS server presenting {@code presented}. */
    static Result validate(X509Bundle presented, int responderPort) throws Exception {
        try (TlsServer server = new TlsServer(presented)) {
            EventLoopGroup group = new MultiThreadIoEventLoopGroup(1, NioIoHandler.newFactory());
            IoTransport transport = IoTransport.create(group.next(),
                    NioSocketChannel::new, NioDatagramChannel::new);
            Result result = null;
            try {
                result = connect(root(), server.port(), transport);
                return result;
            } finally {
                if (result != null) {
                    result.close();
                }
                group.shutdownGracefully().syncUninterruptibly();
            }
        }
    }

    private OcspTestSupport() {
    }
}
