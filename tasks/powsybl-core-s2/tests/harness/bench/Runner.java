package bench;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Minimal JUnit-5-annotation runner that writes one JUnit XML file. It exists so the hidden
 * suites and pristine copies of the project's own tests can run without the project's build
 * configuration. Supports @Test, @BeforeEach and @AfterEach on public or package-private methods.
 */
public final class Runner {

    private Runner() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: Runner <out.xml> <class> [class...]");
            System.exit(2);
        }
        Path out = Path.of(args[0]);
        List<String> classNames = Arrays.asList(args).subList(1, args.length);

        int tests = 0;
        int failures = 0;
        int errors = 0;
        StringBuilder cases = new StringBuilder();

        for (String className : classNames) {
            List<Method> testMethods;
            try {
                Class<?> cls = Class.forName(className);
                testMethods = annotated(cls, Test.class);
                List<Method> befores = annotated(cls, BeforeEach.class);
                List<Method> afters = annotated(cls, AfterEach.class);
                for (Method test : testMethods) {
                    tests++;
                    Throwable failure = null;
                    try {
                        Constructor<?> constructor = cls.getDeclaredConstructor();
                        constructor.setAccessible(true);
                        Object instance = constructor.newInstance();
                        try {
                            for (Method before : befores) {
                                invoke(before, instance);
                            }
                            invoke(test, instance);
                        } finally {
                            for (Method after : afters) {
                                try {
                                    invoke(after, instance);
                                } catch (Throwable t) {
                                    if (failure == null) {
                                        failure = unwrap(t);
                                    }
                                }
                            }
                        }
                    } catch (Throwable t) {
                        failure = unwrap(t);
                    }
                    cases.append("  <testcase classname=\"").append(escape(className))
                            .append("\" name=\"").append(escape(test.getName())).append("\"");
                    if (failure == null) {
                        cases.append("/>\n");
                    } else {
                        boolean assertion = failure instanceof AssertionError;
                        if (assertion) {
                            failures++;
                        } else {
                            errors++;
                        }
                        String element = assertion ? "failure" : "error";
                        cases.append(">\n    <").append(element)
                                .append(" message=\"").append(escape(String.valueOf(failure.getMessage()))).append("\">")
                                .append(escape(stackTrace(failure)))
                                .append("</").append(element).append(">\n  </testcase>\n");
                    }
                }
            } catch (Throwable t) {
                // A class that cannot even be loaded is reported as one error rather than crashing
                // the whole group; the reward then reflects a real failure.
                tests++;
                errors++;
                cases.append("  <testcase classname=\"").append(escape(className))
                        .append("\" name=\"classLoad\">\n    <error message=\"")
                        .append(escape(String.valueOf(t.getMessage()))).append("\">")
                        .append(escape(stackTrace(t))).append("</error>\n  </testcase>\n");
            }
        }

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<testsuite name=\"bench\" tests=\"").append(tests)
                .append("\" failures=\"").append(failures)
                .append("\" errors=\"").append(errors)
                .append("\" skipped=\"0\">\n");
        xml.append(cases);
        xml.append("</testsuite>\n");
        Files.writeString(out, xml.toString(), StandardCharsets.UTF_8);
        System.out.println("ran " + tests + " tests, " + failures + " failures, " + errors + " errors");
        if (failures + errors > 0) {
            System.exit(1);
        }
    }

    private static List<Method> annotated(Class<?> cls, Class<? extends java.lang.annotation.Annotation> annotation) {
        List<Method> result = new ArrayList<>();
        for (Method method : cls.getDeclaredMethods()) {
            if (method.isAnnotationPresent(annotation)) {
                method.setAccessible(true);
                result.add(method);
            }
        }
        result.sort((a, b) -> a.getName().compareTo(b.getName()));
        return result;
    }

    private static void invoke(Method method, Object instance) throws Throwable {
        try {
            method.invoke(instance);
        } catch (java.lang.reflect.InvocationTargetException e) {
            throw e.getCause() == null ? e : e.getCause();
        }
    }

    private static Throwable unwrap(Throwable t) {
        if (t instanceof java.lang.reflect.InvocationTargetException && t.getCause() != null) {
            return t.getCause();
        }
        return t;
    }

    private static String stackTrace(Throwable t) {
        StringWriter writer = new StringWriter();
        t.printStackTrace(new PrintWriter(writer));
        return writer.toString();
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&apos;");
                default -> {
                    if (c == 0 || (c < 0x20 && c != '\n' && c != '\r' && c != '\t')) {
                        out.append(' ');
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.toString();
    }
}
