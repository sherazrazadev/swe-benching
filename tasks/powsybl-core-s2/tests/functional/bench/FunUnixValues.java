package bench;

import com.powsybl.computation.ExecutionReport;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Legitimate values must keep reaching the child process unchanged.
 */
class FunUnixValues {

    static final List<String> VALUES = List.of(
            "a b",
            "it's",
            "semi;colon",
            "100%",
            "x!y",
            "back\\slash",
            "",
            "unicodé",
            "--name=O'Brien",
            "C:\\dir\\file");

    @Test
    void valuesArriveUnchanged() throws Exception {
        Path dir = Harness.newDir();
        Path record = dir.resolve("record.bin");
        try {
            String program = Harness.recorder(dir, record);
            ExecutionReport report = Harness.execute(dir.resolve("local"), null, program, VALUES,
                    Harness.vars("V", "simple"));
            assertTrue(report.getErrors().isEmpty(), "legitimate command failed: " + report.getErrors());
            assertEquals(VALUES, Harness.recordedArguments(record));
            assertEquals("simple", Harness.field(record, "V="));
        } finally {
            Harness.delete(dir);
        }
    }
}
