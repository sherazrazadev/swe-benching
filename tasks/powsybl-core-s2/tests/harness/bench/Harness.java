package bench;

import com.powsybl.computation.AbstractExecutionHandler;
import com.powsybl.computation.CommandExecution;
import com.powsybl.computation.ComputationManager;
import com.powsybl.computation.ExecutionEnvironment;
import com.powsybl.computation.ExecutionReport;
import com.powsybl.computation.SimpleCommand;
import com.powsybl.computation.SimpleCommandBuilder;
import com.powsybl.computation.local.LocalComputationConfig;
import com.powsybl.computation.local.LocalComputationManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Test-side helpers. Everything a test needs to compute its expected values and to clean up is
 * done here, in test code, never in the product under test.
 */
public final class Harness {

    private static final long EXECUTION_TIMEOUT_SECONDS = 120;

    private Harness() {
    }

    /** A fresh, private directory for one test. */
    public static Path newDir() throws IOException {
        return Files.createTempDirectory("powsybl-bench-");
    }

    /** Delete a directory tree without using any product code. */
    public static void delete(Path root) {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try (var stream = Files.walk(root)) {
            stream.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // best effort cleanup
                }
            });
        } catch (IOException ignored) {
            // best effort cleanup
        }
    }

    /** Write an executable helper script and return its absolute path. */
    public static String writeScript(Path file, String body) throws IOException {
        Files.createDirectories(file.getParent());
        Files.writeString(file, body, StandardCharsets.UTF_8);
        Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rwxr-xr-x"));
        return file.toAbsolutePath().toString();
    }

    /**
     * A recorder program. It writes its own arguments (NUL separated), the value of V, whether a
     * helper named mytool is reachable through the inherited search setting, and the value of the
     * inherited search setting, into {@code record}.
     */
    public static String recorder(Path dir, Path record) throws IOException {
        String out = record.toAbsolutePath().toString();
        String body = "#!/bin/sh\n"
                + "out='" + out + "'\n"
                + ": > \"$out\"\n"
                + "for a in \"$@\"; do printf '%s\\000' \"$a\" >> \"$out\"; done\n"
                + "printf 'ARGS_END\\000' >> \"$out\"\n"
                + "printf 'V=%s\\000' \"$V\" >> \"$out\"\n"
                + "if command -v mytool >/dev/null 2>&1; then printf 'TOOL=found\\000' >> \"$out\"; "
                + "else printf 'TOOL=missing\\000' >> \"$out\"; fi\n"
                + "printf 'SEARCHVAL=%s\\000' \"$PATH\" >> \"$out\"\n";
        return writeScript(dir.resolve("recorder.sh"), body);
    }

    /** A small executable named mytool, meant to be found through the child's search setting. */
    public static Path installTool(Path dir) throws IOException {
        Path tool = dir.resolve("mytool");
        writeScript(tool, "#!/bin/sh\necho tool-ran\n");
        return tool;
    }

    /** Split a recorder file into its NUL-separated fields. */
    public static List<String> fields(Path record) throws IOException {
        byte[] bytes = Files.readAllBytes(record);
        List<String> fields = new ArrayList<>();
        ByteArrayOutputStream current = new ByteArrayOutputStream();
        for (byte b : bytes) {
            if (b == 0) {
                fields.add(current.toString(StandardCharsets.UTF_8));
                current.reset();
            } else {
                current.write(b);
            }
        }
        if (current.size() > 0) {
            fields.add(current.toString(StandardCharsets.UTF_8));
        }
        return fields;
    }

    /** The argument fields are the leading recorder fields, terminated by the ARGS_END marker. */
    public static List<String> recordedArguments(Path record) throws IOException {
        List<String> args = new ArrayList<>();
        for (String field : fields(record)) {
            if ("ARGS_END".equals(field)) {
                break;
            }
            args.add(field);
        }
        return args;
    }

    /** Field lookup for the recorder's named values. */
    public static String field(Path record, String prefix) throws IOException {
        for (String field : fields(record)) {
            if (field.startsWith(prefix)) {
                return field.substring(prefix.length());
            }
        }
        return null;
    }

    /** The only directory the working directory machinery creates under {@code localBase}. */
    public static Path workingDirectory(Path localBase) throws IOException {
        try (var stream = Files.list(localBase)) {
            return stream.filter(Files::isDirectory).findFirst().orElse(null);
        }
    }

    /**
     * Drive one command through the product's public local computation manager. {@code executor}
     * selects a configured execution backend; null means the platform default.
     */
    public static ExecutionReport execute(Path localBase, String executor, String program,
                                          List<String> args, Map<String, String> variables) throws Exception {
        Files.createDirectories(localBase);
        LocalComputationConfig config = new LocalComputationConfig(localBase, 1, executor);
        try (ComputationManager manager = new LocalComputationManager(config)) {
            SimpleCommand command = new SimpleCommandBuilder()
                    .id("cmd")
                    .program(program)
                    .args(args)
                    .build();
            ExecutionEnvironment environment = new ExecutionEnvironment(
                    new LinkedHashMap<>(variables), "bench", true);
            AbstractExecutionHandler<ExecutionReport> handler = new AbstractExecutionHandler<>() {
                @Override
                public List<CommandExecution> before(Path workingDir) {
                    return List.of(new CommandExecution(command, 1));
                }

                @Override
                public ExecutionReport after(Path workingDir, ExecutionReport report) {
                    return report;
                }
            };
            return manager.execute(environment, handler).get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        }
    }

    /** Convenience map builder. */
    public static Map<String, String> vars(String... keysAndValues) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keysAndValues.length; i += 2) {
            map.put(keysAndValues[i], keysAndValues[i + 1]);
        }
        return map;
    }
}
