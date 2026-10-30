/*
 * Security suite: a client chosen field name must not steer what the application writes.
 */
package camelsec;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class SecSideEffectTest {

    private static final String SENDER_NAME = "sender-chosen.txt";

    @Test
    public void structuredFieldDoesNotNameTheWrittenFile() throws Exception {
        Path directory = Files.createTempDirectory("camel-sec-structured-");
        try {
            try (Harness harness = new Harness("1.0", directory)) {
                Map<String, Object> content = Harness.event("1.0");
                content.put("CamelFileName", SENDER_NAME);
                harness.postStructured(content);
            }

            List<Path> files = list(directory);
            assertTrue(files.stream().anyMatch(p -> "test".equals(read(p))),
                    "the event body was not processed at all");
            assertFalse(files.stream().anyMatch(p -> SENDER_NAME.equals(p.getFileName().toString())),
                    "the application wrote a file under a name chosen by the client");
        } finally {
            delete(directory);
        }
    }

    @Test
    public void binaryFieldDoesNotNameTheWrittenFile() throws Exception {
        Path directory = Files.createTempDirectory("camel-sec-binary-");
        try {
            try (Harness harness = new Harness("1.0", directory)) {
                Map<String, String> headers = Harness.binaryHeaders("1.0");
                headers.put("ce-CamelFileName", SENDER_NAME);
                harness.postBinary(headers);
            }

            List<Path> files = list(directory);
            assertTrue(files.stream().anyMatch(p -> "test".equals(read(p))),
                    "the event body was not processed at all");
            assertFalse(files.stream().anyMatch(p -> SENDER_NAME.equals(p.getFileName().toString())),
                    "the application wrote a file under a name chosen by the client");
        } finally {
            delete(directory);
        }
    }

    private static List<Path> list(Path directory) throws IOException {
        try (Stream<Path> stream = Files.list(directory)) {
            return stream.collect(Collectors.toList());
        }
    }

    private static String read(Path path) {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            return null;
        }
    }

    private static void delete(Path directory) {
        try (Stream<Path> stream = Files.walk(directory)) {
            stream.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // best effort cleanup
                }
            });
        } catch (IOException ignored) {
            // best effort cleanup
        }
    }
}
