package hidden.support;

import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/**
 * Minimal JUnit-XML writer for plain Java test classes: every public no-argument method whose
 * name starts with "test" is one case. A thrown AssertionError is a failure; anything else is an error.
 */
public final class JUnitXmlRunner {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: JUnitXmlRunner <out.xml> <class> [class...]");
            System.exit(2);
        }
        String out = args[0];
        List<String> failures = new ArrayList<>();
        int total = 0;
        Document doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().newDocument();
        Element suites = doc.createElement("testsuites");
        doc.appendChild(suites);

        for (int i = 1; i < args.length; i++) {
            String className = args[i];
            Element suite = doc.createElement("testsuite");
            suite.setAttribute("name", className);
            suites.appendChild(suite);
            Class<?> type;
            try {
                type = Class.forName(className);
            } catch (Throwable t) {
                Element tc = doc.createElement("testcase");
                tc.setAttribute("classname", className);
                tc.setAttribute("name", "load");
                Element err = doc.createElement("error");
                err.setAttribute("message", String.valueOf(t));
                tc.appendChild(err);
                suite.appendChild(tc);
                total++;
                failures.add(className + "::load: " + t);
                continue;
            }
            Object instance;
            try {
                instance = type.getDeclaredConstructor().newInstance();
            } catch (Throwable t) {
                Element tc = doc.createElement("testcase");
                tc.setAttribute("classname", className);
                tc.setAttribute("name", "construct");
                Element err = doc.createElement("error");
                err.setAttribute("message", String.valueOf(t));
                tc.appendChild(err);
                suite.appendChild(tc);
                total++;
                failures.add(className + "::construct: " + t);
                continue;
            }
            for (Method m : type.getMethods()) {
                if (m.getParameterCount() != 0 || !m.getName().startsWith("test")) continue;
                total++;
                Element tc = doc.createElement("testcase");
                tc.setAttribute("classname", className);
                tc.setAttribute("name", m.getName());
                long start = System.currentTimeMillis();
                try {
                    m.invoke(instance);
                    tc.setAttribute("time", String.valueOf((System.currentTimeMillis() - start) / 1000.0));
                } catch (InvocationTargetException e) {
                    Throwable cause = e.getCause() == null ? e : e.getCause();
                    Element bad;
                    if (cause instanceof AssertionError) {
                        bad = doc.createElement("failure");
                    } else {
                        bad = doc.createElement("error");
                    }
                    bad.setAttribute("message", String.valueOf(cause));
                    bad.setTextContent(stack(cause));
                    tc.appendChild(bad);
                    failures.add(className + "::" + m.getName() + ": " + cause);
                } catch (Throwable t) {
                    Element bad = doc.createElement("error");
                    bad.setAttribute("message", String.valueOf(t));
                    bad.setTextContent(stack(t));
                    tc.appendChild(bad);
                    failures.add(className + "::" + m.getName() + ": " + t);
                }
                suite.appendChild(tc);
            }
        }
        suites.setAttribute("tests", String.valueOf(total));
        suites.setAttribute("failures", String.valueOf(failures.size()));

        Transformer tr = TransformerFactory.newInstance().newTransformer();
        tr.setOutputProperty(OutputKeys.INDENT, "yes");
        tr.transform(new DOMSource(doc), new StreamResult(new File(out)));
        for (String f : failures) System.out.println("FAIL " + f);
        System.out.println("ran " + total + ", failed " + failures.size());
        System.exit(failures.isEmpty() ? 0 : 1);
    }

    static String stack(Throwable t) {
        java.io.StringWriter w = new java.io.StringWriter();
        t.printStackTrace(new java.io.PrintWriter(w));
        return w.toString();
    }
}
