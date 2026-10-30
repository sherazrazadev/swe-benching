# Netty: an OCSP answer is trusted for the wrong certificate

Netty is a Java networking library. Its TLS client support can check a server's certificate
against the issuing CA's OCSP responder after the handshake, and it also offers a public helper
for checking an OCSP answer that the application obtained on its own.

## Observed impact

A client that uses the library's OCSP certificate validation accepts the presented server
certificate as valid even though the responder's answer is about a different certificate. Once
the connection is up, the library reports the presented certificate as good, so a certificate
the CA has revoked is accepted whenever a current "good" answer for another certificate from the
same CA is replayed.

To see it: point a server's certificate chain at a responder that returns a correctly signed
answer for some other certificate, connect a client that uses the library's OCSP validation, and
the client reports the presented certificate as valid.

## Security property

An OCSP answer must never be accepted as evidence about a certificate unless it is bound to that
certificate: it must identify the certificate's issuer and serial number, and it must be signed
by that issuer or by a responder the issuer authorized. An answer that identifies any other
certificate must never make the certificate under validation valid. This holds for every answer
the client accepts as evidence about a certificate, however that answer reaches the client,
including one it obtained earlier.

## Contracts

- **Refusal.** When an answer cannot be bound to the certificate under validation, the client
  must not report that certificate as valid, and the failure must be signalled to the pipeline
  (an exception or a closed connection) rather than silently ignored.
- **Legitimate answers keep working.** A correct answer for the certificate under validation
  must still be reported as valid, including when the responder chose a different digest
  algorithm for the certificate identifier and when the answer is signed by a responder the
  issuer authorized rather than by the issuer itself.
- **Statuses keep working.** A correctly bound answer that reports a revoked or unknown
  certificate keeps being reported as such, and an answer that is malformed, stale, or carries
  more than the requested entry keeps being refused as it is today.
- **Current answers keep working.** An answer that is still current keeps being usable for the
  certificate it is bound to.
- The examples above are examples, not the full set of entry points or answer shapes.

## Constraints

Fix the reported problem and its close variants. Keep legitimate use working. Do not look up the
upstream fix. Do not special-case the example.
