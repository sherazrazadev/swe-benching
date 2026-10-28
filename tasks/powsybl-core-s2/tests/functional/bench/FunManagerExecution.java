package bench;

import com.powsybl.computation.ExecutionReport;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The manager must keep running ordinary commands and capturing their standard output.
 */
class FunManagerExecution {

    @Test
    void commandRunsAndStandardOutputIsCaptured() throws Exception {
        Path dir = Harness.newDir();
        Path local = dir.resolve("local");
        try {
            ExecutionReport report = Harness.execute(local, null, "bash",
                    List.of("-c", "echo manager-ok"), java.util.Map.of());
            assertTrue(report.getErrors().isEmpty(), "legitimate command failed: " + report.getErrors());
            Path workingDir = Harness.workingDirectory(local);
            assertNotNull(workingDir, "the execution working directory was not created");
            Path outFile = workingDir.resolve("cmd_0.out");
            assertTrue(Files.exists(outFile), "standard output was not captured");
            assertTrue(Files.readString(outFile).contains("manager-ok"),
                    "captured output does not contain the program output");
        } finally {
            Harness.delete(dir);
        }
    }
}
