package dev.sigstore.hidden;

import dev.sigstore.DetachedSignatureVerifier;
import dev.sigstore.KeylessVerifier;
import dev.sigstore.TrustedRootProvider;
import dev.sigstore.bundle.Bundle;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;

/** Shared helpers for the hidden suites. Reads only checked-in resources. */
public final class HiddenSupport {

  private HiddenSupport() {}

  public static Path resource(String name) {
    return Path.of(System.getProperty("hidden.resources", "/workspace/.htests/resources"))
        .resolve(name);
  }

  public static String read(String name) throws Exception {
    return Files.readString(resource(name), StandardCharsets.UTF_8);
  }

  public static Bundle bundle(String name) throws Exception {
    return Bundle.from(new StringReader(read(name)));
  }

  public static Path artifact() {
    return resource("artifact.txt");
  }

  public static byte[] artifactDigest() throws Exception {
    return MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(artifact()));
  }

  public static KeylessVerifier verifier(String trustedRoot) throws Exception {
    return KeylessVerifier.builder()
        .trustedRootProvider(TrustedRootProvider.from(resource(trustedRoot)))
        .build();
  }

  public static DetachedSignatureVerifier detachedVerifier(String trustedRoot) throws Exception {
    return DetachedSignatureVerifier.builder()
        .trustedRootProvider(TrustedRootProvider.from(resource(trustedRoot)))
        .build();
  }
}
