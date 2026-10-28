package bench;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * Quoting must survive a value that contains the quote character itself.
 */
class SecShellQuoting {

    @Test
    void anApostropheCannotEndTheQuotedWord() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-single-quote");
        try {
            String value = "'; touch " + marker + "; #'";
            try {
                Harness.execute(dir.resolve("local"), "shell", "echo", List.of(value), Map.of());
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "value escaped its quoting context");
        } finally {
            Harness.delete(dir);
        }
    }
}
