package bench.ccas;

import org.junit.runner.Description;
import org.junit.runner.JUnitCore;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import org.junit.runner.notification.RunListener;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Runs the given JUnit classes and writes one JUnit XML file. A failure, an error and a
 * missing class all become failing test cases; nothing is ever silently dropped.
 */
public class JUnitXmlRunner {

    private static final class Case {
        final String className;
        final String name;
        String failure;
        String stack;
        boolean started;

        Case(String className, String name) {
            this.className = className;
            this.name = name;
        }
    }

    public static void main(String[] args) throws Exception {
        File out = new File(args[0]);
        List<Class<?>> classes = new ArrayList<Class<?>>();
        for (int i = 1; i < args.length; i++) {
            try {
                classes.add(Class.forName(args[i]));
            } catch (Throwable t) {
                Case c = new Case(args[i], "load");
                c.failure = "could not load test class: " + t;
                c.stack = stack(t);
                write(out, java.util.Collections.singletonList(c));
                return;
            }
        }

        final Map<String, Case> cases = new LinkedHashMap<String, Case>();
        JUnitCore core = new JUnitCore();
        core.addListener(new RunListener() {
            public void testStarted(Description d) {
                Case c = new Case(d.getClassName(), method(d));
                c.started = true;
                cases.put(d.getClassName() + "::" + c.name, c);
            }

            public void testFailure(Failure f) {
                Description d = f.getDescription();
                String key = d.getClassName() + "::" + method(d);
                Case c = cases.get(key);
                if (c == null) {
                    c = new Case(d.getClassName(), method(d));
                    cases.put(key, c);
                }
                c.failure = f.getMessage() == null ? f.getException().toString() : f.getMessage();
                c.stack = f.getTrace();
            }

            public void testAssumptionFailure(Failure f) {
                testFailure(f);
            }
        });
        Result result = core.run(classes.toArray(new Class<?>[0]));

        List<Case> ordered = new ArrayList<Case>(cases.values());
        write(out, ordered);

        int failed = 0;
        for (Case c : ordered) {
            if (c.failure != null) {
                failed++;
            }
        }
        System.out.println("ran " + ordered.size() + ", failed " + failed);
        Runtime.getRuntime().halt(failed == 0 && result.wasSuccessful() ? 0 : 1);
    }

    private static String method(Description d) {
        return d.getMethodName() == null ? "class" : d.getMethodName();
    }

    private static String stack(Throwable t) {
        java.io.StringWriter sw = new java.io.StringWriter();
        t.printStackTrace(new java.io.PrintWriter(sw));
        return sw.toString();
    }

    private static void write(File out, List<Case> cases) throws IOException {
        File dir = out.getParentFile();
        if (dir != null && !dir.isDirectory()) {
            dir.mkdirs();
        }
        StringBuilder b = new StringBuilder();
        int failures = 0;
        for (Case c : cases) {
            if (c.failure != null) {
                failures++;
            }
        }
        b.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        b.append("<testsuite name=\"security-fix\" tests=\"").append(cases.size())
                .append("\" failures=\"").append(failures).append("\" errors=\"0\" skipped=\"0\">\n");
        for (Case c : cases) {
            b.append("  <testcase classname=\"").append(esc(c.className)).append("\" name=\"")
                    .append(esc(c.name)).append("\">\n");
            if (c.failure != null) {
                b.append("    <failure message=\"").append(esc(c.failure)).append("\">")
                        .append(esc(c.stack == null ? c.failure : c.stack)).append("</failure>\n");
            }
            b.append("  </testcase>\n");
        }
        b.append("</testsuite>\n");
        Writer w = new OutputStreamWriter(new FileOutputStream(out), "UTF-8");
        try {
            w.write(b.toString());
        } finally {
            w.close();
        }
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("\r", "");
    }
}
