package bench;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * The program word is supplied to the layer too; it must not be able to carry a second command.
 */
class SecUnixProgram {

    @Test
    void theProgramWordCannotChainASecondCommand() throws Exception {
        Path dir = Harness.newDir();
        Path marker = dir.resolve("outside-program");
        try {
            String program = "echo; touch " + marker;
            try {
                Harness.execute(dir.resolve("local"), null, program, List.of("x"), Map.of());
            } catch (Throwable refusal) {
                // Any refusal is acceptable; only the side effect matters.
            }
            assertFalse(Files.exists(marker), "program word was evaluated by the shell");
        } finally {
            Harness.delete(dir);
        }
    }
}
