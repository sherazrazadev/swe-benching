package bench;

import hudson.model.User;
import java.net.URI;
import jenkins.model.Jenkins;
import org.htmlunit.HttpMethod;
import org.htmlunit.Page;
import org.htmlunit.WebRequest;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.MockAuthorizationStrategy;

/**
 * Shared fixture for the behavioural suites: a real controller with an administrator and the
 * product's own configuration-document endpoints.
 */
public final class Support {

    public static final String ADMIN = "admin";

    private Support() {
    }

    public static void secure(JenkinsRule j) throws Exception {
        j.jenkins.setSecurityRealm(j.createDummySecurityRealm());
        j.jenkins.setAuthorizationStrategy(new MockAuthorizationStrategy()
                .grant(Jenkins.ADMINISTER).everywhere().to(ADMIN));
        User.getById(ADMIN, true);
    }

    /** Submits a configuration document the way a configuring user does; returns the status. */
    public static int postXml(JenkinsRule j, String path, String xml) throws Exception {
        try (JenkinsRule.WebClient wc =
                j.createWebClient().withBasicApiToken(ADMIN).withThrowExceptionOnFailingStatusCode(false)) {
            WebRequest request = new WebRequest(URI.create(wc.getContextPath() + path).toURL(), HttpMethod.POST);
            request.setAdditionalHeader("Content-Type", "application/xml");
            request.setRequestBody(xml);
            Page page = wc.getPage(request);
            return page.getWebResponse().getStatusCode();
        }
    }

    /** Reads a configuration document the way a configuring user does. */
    public static String getXml(JenkinsRule j, String path) throws Exception {
        try (JenkinsRule.WebClient wc =
                j.createWebClient().withBasicApiToken(ADMIN).withThrowExceptionOnFailingStatusCode(false)) {
            Page page = wc.getPage(wc.getContextPath() + path);
            return (String) page.getWebResponse().getContentAsString();
        }
    }

    /** Puts an element inside the node-properties element of a node configuration document. */
    public static String withNodeProperties(String document, String element) {
        String replacement = "<nodeProperties>" + element + "</nodeProperties>";
        if (document.contains("<nodeProperties/>")) {
            return document.replace("<nodeProperties/>", replacement);
        }
        return document.replace("</hudson.slaves.DumbSlave>", replacement + "</hudson.slaves.DumbSlave>");
    }
}
