package bench;

import com.powsybl.computation.ExecutionReport;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * A search-path setting must still extend the inherited value: the child must find both the
 * program placed on the new setting and everything the parent could find.
 */
class FunUnixSearchPath {

    @Test
    void searchPathSettingStillExtendsTheCurrentValue() throws Exception {
        Path dir = Harness.newDir();
        Path record = dir.resolve("record.bin");
        try {
            Path extra = Files.createDirectory(dir.resolve("extra"));
            Harness.installTool(extra);
            String program = Harness.recorder(dir, record);
            ExecutionReport report = Harness.execute(dir.resolve("local"), null, program,
                    java.util.List.of(), Harness.vars("PATH", extra.toString()));
            assertTrue(report.getErrors().isEmpty(), "legitimate command failed: " + report.getErrors());
            assertEquals("found", Harness.field(record, "TOOL="));
            String search = Harness.field(record, "SEARCHVAL=");
            assertNotNull(search);
            assertTrue(search.startsWith(extra + ":"), "the new setting did not lead the search value: " + search);
            String parent = System.getenv("PATH");
            assertNotNull(parent);
            assertTrue(search.endsWith(parent), "the inherited part of the search value was lost: " + search);
        } finally {
            Harness.delete(dir);
        }
    }
}
