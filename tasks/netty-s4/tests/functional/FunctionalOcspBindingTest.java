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
import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.bouncycastle.cert.ocsp.RevokedStatus;
import org.junit.jupiter.api.Test;

import java.util.Date;

import static io.netty.handler.ssl.ocsp.OcspTestSupport.answerFor;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.answerFromDelegatedResponder;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.answerWithTwoEntries;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.basicResponse;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.certificateId;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.issuer;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.leaf;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.peerChain;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.responseWithUnknownObject;
import static io.netty.handler.ssl.ocsp.OcspTestSupport.unsuccessfulResponse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Legitimate OCSP answers, and the existing refusal behaviour, keep working.
 */
class FunctionalOcspBindingTest {

    @Test
    void correctAnswerIsValid() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle victim = leaf(responder.port());
            responder.setBody(answerFor(victim, false));

            OcspTestSupport.Result result = OcspTestSupport.validate(victim, responder.port());
            assertTrue(result.completed, "validation never completed");
            assertEquals(OcspResponse.Status.VALID, result.status);
            assertNull(result.error);
        }
    }

    @Test
    void answerWithAnotherDigestAlgorithmIsValid() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle victim = leaf(responder.port());
            responder.setBody(answerFor(victim, true));

            OcspTestSupport.Result result = OcspTestSupport.validate(victim, responder.port());
            assertTrue(result.completed, "validation never completed");
            assertEquals(OcspResponse.Status.VALID, result.status,
                    "an answer that identifies the certificate with another digest was rejected");
        }
    }

    @Test
    void answerFromDelegatedResponderIsValid() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle victim = leaf(responder.port());
            responder.setBody(answerFromDelegatedResponder(victim));

            OcspTestSupport.Result result = OcspTestSupport.validate(victim, responder.port());
            assertTrue(result.completed, "validation never completed");
            assertEquals(OcspResponse.Status.VALID, result.status,
                    "an answer signed by an authorized responder was rejected");
        }
    }

    @Test
    void revokedAnswerIsReported() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle victim = leaf(responder.port());
            responder.setBody(answerFor(victim,
                    new RevokedStatus(new Date(System.currentTimeMillis() - 1000), 0), false));

            OcspTestSupport.Result result = OcspTestSupport.validate(victim, responder.port());
            assertTrue(result.completed, "validation never completed");
            assertEquals(OcspResponse.Status.REVOKED, result.status);
        }
    }

    @Test
    void answerWithSeveralEntriesIsRefused() throws Exception {
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            X509Bundle victim = leaf(responder.port());
            X509Bundle other = leaf(responder.port());
            responder.setBody(answerWithTwoEntries(victim, other));

            OcspTestSupport.Result result = OcspTestSupport.validate(victim, responder.port());
            assertTrue(result.completed, "validation never completed");
            assertNotEquals(OcspResponse.Status.VALID, result.status);
            assertNotNull(result.error, "an answer with several entries must be refused");
        }
    }

    @Test
    void malformedAnswerIsRefused() throws Exception {
        for (byte[] answer : new byte[][]{ responseWithUnknownObject(), unsuccessfulResponse() }) {
            try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
                X509Bundle victim = leaf(responder.port());
                responder.setBody(answer);

                OcspTestSupport.Result result = OcspTestSupport.validate(victim, responder.port());
                assertTrue(result.completed, "validation never completed");
                assertNotEquals(OcspResponse.Status.VALID, result.status);
                assertNotNull(result.error, "a malformed answer must be refused");
            }
        }
    }

    @Test
    void outOfBandCorrectAnswerIsValid() throws Exception {
        X509Bundle victim = leaf(1);
        OcspResponse response = OcspResponseValidator.validate(
                basicResponse(certificateId(issuer().getCertificate(),
                        victim.getCertificate().getSerialNumber(), false),
                        CertificateStatus.GOOD, issuer(), null, issuer()),
                peerChain(victim));
        assertEquals(OcspResponse.Status.VALID, response.status());
    }

    @Test
    void outOfBandAnswerForAnotherCertificateIsRefused() throws Exception {
        X509Bundle victim = leaf(1);
        X509Bundle other = leaf(1);
        try {
            OcspResponse response = OcspResponseValidator.validate(
                    basicResponse(certificateId(issuer().getCertificate(),
                            other.getCertificate().getSerialNumber(), false),
                            CertificateStatus.GOOD, issuer(), null, issuer()),
                    peerChain(victim));
            assertNotEquals(OcspResponse.Status.VALID, response.status(),
                    "an answer for another certificate was accepted");
        } catch (Exception expected) {
            // Refusal by exception is fine.
        }
    }

    @Test
    void reusedAnswerForTheSameCertificateStillWorks() throws Exception {
        X509Bundle victim;
        int responderPort;
        try (OcspTestSupport.Responder responder = new OcspTestSupport.Responder()) {
            responderPort = responder.port();
            victim = leaf(responderPort);
            responder.setBody(answerFor(victim, false));

            OcspTestSupport.Result first = OcspTestSupport.validate(victim, responderPort);
            assertTrue(first.completed, "the first validation never completed");
            assertEquals(OcspResponse.Status.VALID, first.status);
        }
        // The responder is gone; a current answer that is kept for this certificate must still work.
        OcspTestSupport.Result second = OcspTestSupport.validate(victim, responderPort);
        assertTrue(second.completed, "the second validation never completed");
        assertEquals(OcspResponse.Status.VALID, second.status,
                "a current answer for the same certificate was no longer usable");
    }
}
