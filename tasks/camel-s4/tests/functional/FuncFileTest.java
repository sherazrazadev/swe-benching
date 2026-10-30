/*
 * Functional suite: the route still processes and writes the events it processes today.
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

import static org.junit.jupiter.api.Assertions.assertTrue;

public class FuncFileTest {

    @Test
    public void structuredEventIsWrittenToTheFolder() throws Exception {
        Path directory = Files.createTempDirectory("camel-func-structured-");
        try {
            try (Harness harness = new Harness("1.0", directory)) {
                Map<String, Object> content = Harness.event("1.0");
                content.put("myextension", "myvalue");
                harness.postStructured(content);
            }

            assertTrue(list(directory).stream().anyMatch(p -> "test".equals(read(p))),
                    "a legitimate structured event was not processed");
        } finally {
            delete(directory);
        }
    }

    @Test
    public void binaryEventIsWrittenToTheFolder() throws Exception {
        Path directory = Files.createTempDirectory("camel-func-binary-");
        try {
            try (Harness harness = new Harness("1.0", directory)) {
                Map<String, String> headers = Harness.binaryHeaders("1.0");
                headers.put("ce-myextension", "myvalue");
                harness.postBinary(headers);
            }

            assertTrue(list(directory).stream().anyMatch(p -> "test".equals(read(p))),
                    "a legitimate binary event was not processed");
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
