package dev.sigstore.hidden;

import static org.junit.jupiter.api.Assertions.assertThrows;

import dev.sigstore.VerificationOptions;
import dev.sigstore.bundle.ImmutableBundle;
import dev.sigstore.rekor.client.ImmutableRekorEntry;
import dev.sigstore.rekor.client.ImmutableVerification;
import dev.sigstore.rekor.client.RekorEntry;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The signing time that decides certificate validity must be authenticated. None of these inputs
 * carries a verified signing time, so verification must refuse them.
 */
public class SecurityTests {

  private static RekorEntry withBlankLogSignature(RekorEntry entry) {
    return ImmutableRekorEntry.builder()
        .from(entry)
        .verification(
            ImmutableVerification.builder()
                .from(entry.getVerification())
                .signedEntryTimestamp("")
                .build())
        .build();
  }

  private static RekorEntry withoutLogSignature(RekorEntry entry) {
    return ImmutableRekorEntry.builder()
        .from(entry)
        .verification(
            ImmutableVerification.builder()
                .inclusionProof(entry.getVerification().getInclusionProof())
                .build())
        .build();
  }

  @Test
  public void bundleWithEntryTimeAfterCertificateExpiryIsRefused() throws Exception {
    var verifier = HiddenSupport.verifier("trusted_root.json");
    var bundle = HiddenSupport.bundle("bundle-with-expired-cert.sigstore");
    assertThrows(
        Throwable.class,
        () -> verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty()));
  }

  @Test
  public void legacyBundleCarryingBlankLogSignatureIsRefused() throws Exception {
    var verifier = HiddenSupport.verifier("trusted_root.json");
    assertThrows(
        Throwable.class,
        () -> {
          var bundle = HiddenSupport.bundle("legacy-empty-set.sigstore.json");
          verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty());
        });
  }

  @Test
  public void bundleBuiltWithBlankLogSignatureIsRefused() throws Exception {
    var verifier = HiddenSupport.verifier("trusted_root.json");
    var base = HiddenSupport.bundle("bundle.v1.sigstore");
    var entry = withBlankLogSignature(base.getEntries().get(0));
    assertThrows(
        Throwable.class,
        () -> {
          var bundle =
              ImmutableBundle.builder()
                  .from(base)
                  .entries(List.of(entry))
                  .timestamps(List.of())
                  .build();
          verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty());
        });
  }

  @Test
  public void detachedVerifierWithBlankLogSignatureIsRefused() throws Exception {
    var verifier = HiddenSupport.detachedVerifier("trusted_root.json");
    var base = HiddenSupport.bundle("bundle.v1.sigstore");
    var entry = withBlankLogSignature(base.getEntries().get(0));
    var signature = base.getMessageSignature().get().getSignature();
    assertThrows(
        Throwable.class,
        () ->
            verifier.verify(
                base.getCertPath(), HiddenSupport.artifactDigest(), signature, entry));
  }

  @Test
  public void detachedVerifierWithoutLogSignatureIsRefused() throws Exception {
    var verifier = HiddenSupport.detachedVerifier("trusted_root.json");
    var base = HiddenSupport.bundle("bundle.v1.sigstore");
    var entry = withoutLogSignature(base.getEntries().get(0));
    var signature = base.getMessageSignature().get().getSignature();
    assertThrows(
        Throwable.class,
        () ->
            verifier.verify(
                base.getCertPath(), HiddenSupport.artifactDigest(), signature, entry));
  }
}
