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

import io.netty.pkitesting.CertificateBuilder;
import io.netty.pkitesting.X509Bundle;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.ocsp.BasicOCSPResp;
import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.bouncycastle.cert.ocsp.OCSPException;
import org.junit.jupiter.api.Test;

import static io.netty.handler.ssl.ocsp.OcspTestSupport.basicResponse;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.certificateId;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * The library's existing signature and responder-chain validation keeps working (the project's own
 * offline tests for this area).
 */
class FunctionalSignatureTest {

    @Test
    void includedChainSignatureValidates() throws Exception {
        X509Bundle rootIssuer = new CertificateBuilder()
                .algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=SomeRootCA")
                .setIsCertificateAuthority(true)
                .buildSelfSigned();
        X509Bundle intermediateIssuer = new CertificateBuilder()
                .algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=SomeIntermediateCA")
                .setIsCertificateAuthority(true)
                .buildIssuedBy(rootIssuer);
        X509Bundle ocspResponder = new CertificateBuilder()
                .algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=SomeOCSPResponder")
                .addExtendedKeyUsageOcspSigning()
                .buildIssuedBy(intermediateIssuer);

        X509CertificateHolder[] chain = {
                OcspTestSupport.holder(ocspResponder), OcspTestSupport.holder(intermediateIssuer)
        };
        BasicOCSPResp response = basicResponse(
                certificateId(intermediateIssuer.getCertificate(), java.math.BigInteger.TEN, false),
                CertificateStatus.GOOD, ocspResponder, chain, ocspResponder);

        assertDoesNotThrow(() -> OcspClient.validateSignature(response, rootIssuer.getCertificate()));
    }

    @Test
    void untrustedChainSignatureIsRejected() throws Exception {
        X509Bundle issuerBundle = new CertificateBuilder()
                .algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=Issuer")
                .setIsCertificateAuthority(true)
                .buildSelfSigned();
        X509Bundle otherRoot = new CertificateBuilder()
                .algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=SomeRootCA")
                .setIsCertificateAuthority(true)
                .buildSelfSigned();
        X509Bundle otherIntermediate = new CertificateBuilder()
                .algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=SomeIntermediateCA")
                .setIsCertificateAuthority(true)
                .buildIssuedBy(otherRoot);
        X509Bundle otherResponder = new CertificateBuilder()
                .algorithm(CertificateBuilder.Algorithm.rsa2048)
                .subject("CN=SomeResponder")
                .buildIssuedBy(otherIntermediate);

        X509CertificateHolder[] chain = {
                OcspTestSupport.holder(otherResponder), OcspTestSupport.holder(otherIntermediate)
        };
        BasicOCSPResp response = basicResponse(
                certificateId(otherIntermediate.getCertificate(), java.math.BigInteger.TEN, false),
                CertificateStatus.GOOD, otherResponder, chain, otherResponder);

        assertThrows(OCSPException.class,
                () -> OcspClient.validateSignature(response, issuerBundle.getCertificate()));
    }
}
