package bench;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * The reported shape: an argument reaches the platform default command execution path and must not
 * be evaluated by the shell.
 */
class SecUnixArguments {

    @Test
    void substitutionInsideAnArgumentIsNotEvaluated() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-argument");
        try {
            String value = "--contingencies=$(touch " + marker + ")";
            try {
                Harness.execute(dir.resolve("local"), null, "echo", List.of(value), Map.of());
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "argument text was evaluated by the shell");
        } finally {
            Harness.delete(dir);
        }
    }

    @Test
    void anArgumentCannotCloseItsWordAndChainACommand() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-argument");
        try {
            String value = "--dsl-file=\"; touch " + marker + "; #";
            try {
                Harness.execute(dir.resolve("local"), null, "echo", List.of(value), Map.of());
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "argument text was evaluated by the shell");
        } finally {
            Harness.delete(dir);
        }
    }
}
