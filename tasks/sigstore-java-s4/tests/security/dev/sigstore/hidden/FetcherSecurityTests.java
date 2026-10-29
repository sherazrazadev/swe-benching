package dev.sigstore.hidden;

import static org.junit.jupiter.api.Assertions.assertThrows;

import dev.sigstore.VerificationOptions;
import dev.sigstore.bundle.ImmutableBundle;
import dev.sigstore.encryption.certificates.Certificates;
import dev.sigstore.rekor.client.HashedRekordRequest;
import dev.sigstore.rekor.client.ImmutableRekorEntry;
import dev.sigstore.rekor.client.ImmutableVerification;
import dev.sigstore.rekor.client.RekorClient;
import dev.sigstore.rekor.client.RekorEntry;
import dev.sigstore.rekor.client.RekorEntryFetcher;
import dev.sigstore.rekor.client.RekorResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * A log entry obtained for separately supplied signing materials may carry an empty signed entry
 * timestamp. The claimed entry time is then not authenticated, so verification must refuse the
 * bundle assembled from it.
 */
public class FetcherSecurityTests {

  @Test
  public void fetchedEntryCarryingBlankLogSignatureIsRefused() throws Exception {
    var verifier = HiddenSupport.verifier("trusted_root.json");
    var base = HiddenSupport.bundle("bundle.v1.sigstore");
    var recorded = base.getEntries().get(0);
    var blank =
        ImmutableRekorEntry.builder()
            .from(recorded)
            .verification(
                ImmutableVerification.builder()
                    .from(recorded.getVerification())
                    .signedEntryTimestamp("")
                    .build())
            .build();
    var leaf = Certificates.getLeaf(base.getCertPath());
    var signature = base.getMessageSignature().get().getSignature();
    var digest = HiddenSupport.artifactDigest();

    RekorClient client =
        new RekorClient() {
          @Override
          public RekorResponse putEntry(HashedRekordRequest request) {
            throw new UnsupportedOperationException();
          }

          @Override
          public Optional<RekorEntry> getEntry(HashedRekordRequest request) {
            return Optional.of(blank);
          }

          @Override
          public Optional<RekorEntry> getEntry(String uuid) {
            return Optional.of(blank);
          }

          @Override
          public List<String> searchEntry(
              String email, String hash, String publicKeyFormat, String publicKeyContent) {
            return List.of();
          }
        };

    var fetcher = new RekorEntryFetcher(List.of(client));
    assertThrows(
        Throwable.class,
        () -> {
          var entry = fetcher.getEntryFromRekor(digest, leaf, signature);
          var bundle =
              ImmutableBundle.builder()
                  .from(base)
                  .entries(List.of(entry))
                  .timestamps(List.of())
                  .build();
          verifier.verify(HiddenSupport.artifact(), bundle, VerificationOptions.empty());
        });
  }
}
