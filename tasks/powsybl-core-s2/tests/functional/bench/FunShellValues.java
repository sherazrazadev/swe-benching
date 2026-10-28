package bench;

import com.powsybl.computation.ExecutionReport;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Legitimate use through the alternative shell backend: literal text stays literal, including
 * characters that only have a meaning when the shell expands them later.
 */
class FunShellValues {

    static final List<String> VALUES = List.of(
            "a b",
            "$HOME",
            "semi;colon",
            "100%",
            "x!y",
            "--name=plain");

    @Test
    void valuesArriveUnchanged() throws Exception {
        Path dir = Harness.newDir();
        Path record = dir.resolve("record.bin");
        try {
            String program = Harness.recorder(dir, record);
            ExecutionReport report = Harness.execute(dir.resolve("local"), "shell", program, VALUES,
                    Harness.vars("V", "$keep me;still"));
            assertTrue(report.getErrors().isEmpty(), "legitimate command failed: " + report.getErrors());
            assertEquals(VALUES, Harness.recordedArguments(record));
            assertEquals("$keep me;still", Harness.field(record, "V="));
        } finally {
            Harness.delete(dir);
        }
    }
}
