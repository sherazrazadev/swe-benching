package bench;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * A command executed through the job-script backend must not have its values interpreted when the
 * script runs.
 */
class SecJobScript {

    @Test
    void substitutionInsideAScriptArgumentIsNotEvaluated() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-script-arg");
        try {
            String value = "--contingencies=$(touch " + marker + ")";
            try {
                Harness.execute(dir.resolve("local"), "job-script", "echo", List.of(value), Map.of());
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "script argument was evaluated by the shell");
        } finally {
            Harness.delete(dir);
        }
    }

    @Test
    void anEnvironmentValueCannotEndItsAssignmentInAScript() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-script-env");
        try {
            Map<String, String> variables = Harness.vars("V", "x\"; touch " + marker + "; #");
            try {
                Harness.execute(dir.resolve("local"), "job-script", "echo", List.of("x"), variables);
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "script environment value was evaluated by the shell");
        } finally {
            Harness.delete(dir);
        }
    }
}
