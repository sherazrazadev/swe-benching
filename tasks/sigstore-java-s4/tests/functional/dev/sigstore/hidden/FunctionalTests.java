package dev.sigstore.hidden;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import dev.sigstore.VerificationOptions;
import org.junit.jupiter.api.Test;

/**
 * Legitimate verification keeps working: a log signature that was verified authenticates the
 * entry time, a verified timestamp is an alternative proof, and a certificate that is expired
 * now is still accepted for a signature whose authenticated time was inside its validity.
 */
public class FunctionalTests {

  @Test
  public void bundleAuthenticatedByLogSignatureStillVerifies() throws Exception {
    var verifier = HiddenSupport.verifier("trusted_root.json");
    var bundle = HiddenSupport.bundle("bundle.v1.sigstore");
    assertDoesNotThrow(
        () -> verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty()));
  }

  @Test
  public void bundleAuthenticatedOnlyByTimestampStillVerifies() throws Exception {
    var verifier = HiddenSupport.verifier("staging_trusted_root.json");
    var bundle = HiddenSupport.bundle("bundle-with-rekor-v2-entry.sigstore");
    assertDoesNotThrow(
        () -> verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty()));
  }

  @Test
  public void bundleWithLogSignatureAndTimestampStillVerifies() throws Exception {
    var verifier = HiddenSupport.verifier("staging_trusted_root.json");
    var bundle = HiddenSupport.bundle("bundle-with-timestamp.sigstore");
    assertDoesNotThrow(
        () -> verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty()));
  }

  @Test
  public void legacyBundleAuthenticatedByLogSignatureStillVerifies() throws Exception {
    var verifier = HiddenSupport.verifier("trusted_root.json");
    var bundle = HiddenSupport.bundle("legacy-valid-set.sigstore.json");
    assertDoesNotThrow(
        () -> verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty()));
  }

  @Test
  public void detachedVerifierWithAuthenticatedLogSignatureStillVerifies() throws Exception {
    var verifier = HiddenSupport.detachedVerifier("trusted_root.json");
    var base = HiddenSupport.bundle("bundle.v1.sigstore");
    var entry = base.getEntries().get(0);
    var signature = base.getMessageSignature().get().getSignature();
    assertDoesNotThrow(
        () ->
            verifier.verify(
                base.getCertPath(), HiddenSupport.artifactDigest(), signature, entry));
  }
}
