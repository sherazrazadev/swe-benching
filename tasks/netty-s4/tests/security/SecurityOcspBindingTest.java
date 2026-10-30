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

import io.netty.pkitesting.X509Bundle;
import org.bouncycastle.cert.ocsp.CertificateID;
import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.junit.jupiter.api.Test;

import static io.netty.handler.ssl.ocsp.OcspTestSupport.answerFor;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.answerNamingAnotherIssuer;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.basicResponse;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.certificateId;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.issuer;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.leaf;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.peerChain;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * A certificate must never be reported valid on the strength of an OCSP answer that is not bound
 * to that very certificate.
 */
class SecurityOcspBindingTest {

    private static void assertRefused(OcspTestSupport.Result result) {
        assertTrue(result.completed, "validation never completed");
        assertNotEquals(OcspResponse.Status.VALID, result.status,
                "the certificate was reported valid on an answer for another certificate");
        assertTrue(result.error != null || result.closed,
                "the refusal was not signalled to the pipeline");
    }

    @Test
    void answerForAnotherCertificateIsRefused() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle victim = leaf(responder.port());
            X509Bundle other = leaf(responder.port());
            responder.setBody(answerFor(other, false));
            assertRefused(OcspTestSupport.validate(victim, responder.port()));
        }
    }

    @Test
    void answerNamingAnotherIssuerIsRefused() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle victim = leaf(responder.port());
            responder.setBody(answerNamingAnotherIssuer(victim));
            assertRefused(OcspTestSupport.validate(victim, responder.port()));
        }
    }

    @Test
    void answerReusedForAnotherCertificateIsRefused() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle first = leaf(responder.port());
            X509Bundle second = leaf(responder.port());
            responder.setBody(answerFor(first, false));

            OcspTestSupport.Result firstRun = OcspTestSupport.validate(first, responder.port());
            assertTrue(firstRun.completed, "the first validation never completed");
            assertTrue(firstRun.status == OcspResponse.Status.VALID,
                    "a correct answer for the presented certificate must still be accepted");

            assertRefused(OcspTestSupport.validate(second, responder.port()));
        }
    }

    @Test
    void outOfBandAnswerNamingAnotherIssuerIsRefused() throws Exception {
        X509Bundle victim = leaf(1);
        CertificateID id = certificateId(OcspTestSupport.rogueIssuer().getCertificate(),
                victim.getCertificate().getSerialNumber(), false);
        try {
            OcspResponse response = OcspResponseValidator.validate(
                    basicResponse(id, CertificateStatus.GOOD, issuer(), null, issuer()), peerChain(victim));
            assertNotEquals(OcspResponse.Status.VALID, response.status(),
                    "an out-of-band answer for another issuer was accepted");
        } catch (Exception expected) {
            // A thrown failure is the other acceptable refusal.
        }
    }
}
