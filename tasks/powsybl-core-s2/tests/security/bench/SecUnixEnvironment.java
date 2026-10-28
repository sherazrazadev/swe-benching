package bench;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * Environment entries reach the same shell command line as arguments; neither the value nor the
 * name may become shell syntax.
 */
class SecUnixEnvironment {

    @Test
    void substitutionInAnEnvironmentValueIsNotEvaluated() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-value");
        try {
            Map<String, String> variables = Harness.vars("V", "$(touch " + marker + ")");
            try {
                Harness.execute(dir.resolve("local"), null, "echo", List.of("x"), variables);
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "environment value was evaluated by the shell");
        } finally {
            Harness.delete(dir);
        }
    }

    @Test
    void anEnvironmentNameCannotCarryASubstitution() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-name");
        try {
            Map<String, String> variables = Harness.vars("X$(touch " + marker + ")", "value");
            try {
                Harness.execute(dir.resolve("local"), null, "echo", List.of("x"), variables);
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "environment name was evaluated by the shell");
        } finally {
            Harness.delete(dir);
        }
    }
}
