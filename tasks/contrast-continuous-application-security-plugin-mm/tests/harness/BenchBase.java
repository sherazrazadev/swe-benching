package bench.ccas;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import hudson.model.FreeStyleProject;
import hudson.model.Item;
import jenkins.model.Jenkins;
import org.htmlunit.HttpMethod;
import org.htmlunit.Page;
import org.htmlunit.WebRequest;
import org.htmlunit.html.HtmlForm;
import org.htmlunit.html.HtmlPage;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.MockAuthorizationStrategy;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/**
 * Fixture shared by the behavioural suites: a real Jenkins controller, a per-user permission
 * matrix, one Contrast connection profile whose applications and rules carry markers, a job with the
 * publisher attached, and a loopback TeamServer that records every request the plugin makes.
 */
public abstract class BenchBase {

    protected static final String ADMIN = "admin";
    protected static final String READER = "reader";
    protected static final String CONFIGURER = "configurer";

    protected static final String JOB = "target-job";
    protected static final String PROFILE = "PROFILE_MARKER";
    protected static final String APP_TITLE = "APP_TITLE_MARKER";
    protected static final String APP_ID = "app-id-marker";
    protected static final String RULE_TITLE = "RULE_TITLE_MARKER";
    protected static final String RULE_NAME = "rule-name-marker";
    protected static final String ORG = "org-marker";
    protected static final String UNKNOWN_APP = "NOT_IN_PROFILE";

    protected static final String DESCRIPTOR_ROOT =
            "descriptorByName/com.aspectsecurity.contrast.contrastjenkins.";

    @Rule
    public JenkinsRule j = new JenkinsRule();

    protected TeamServerStub teamServer;
    protected FreeStyleProject job;

    private final Map<String, JenkinsRule.WebClient> clients = new HashMap<String, JenkinsRule.WebClient>();

    @Before
    public void setUp() throws Exception {
        j.jenkins.setSecurityRealm(j.createDummySecurityRealm());
        j.jenkins.setCrumbIssuer(null);
        j.jenkins.setAuthorizationStrategy(new MockAuthorizationStrategy()
                .grant(Jenkins.ADMINISTER).everywhere().to(ADMIN)
                .grant(Jenkins.READ).everywhere().to(READER)
                .grant(Item.READ).everywhere().to(READER)
                .grant(Jenkins.READ).everywhere().to(CONFIGURER)
                .grant(Item.READ).everywhere().to(CONFIGURER)
                .grant(Item.CONFIGURE).everywhere().to(CONFIGURER));

        teamServer = new TeamServerStub();
        writeProfile();

        job = j.createFreeStyleProject(JOB);
        job.getPublishersList().add(new com.aspectsecurity.contrast.contrastjenkins.VulnerabilityTrendRecorder(
                Collections.<com.aspectsecurity.contrast.contrastjenkins.ThresholdCondition>emptyList(),
                PROFILE, false, 0));
        job.save();
    }

    @After
    public void tearDown() {
        if (teamServer != null) {
            teamServer.stop();
        }
    }

    // ---------------------------------------------------------------- profile setup

    protected com.aspectsecurity.contrast.contrastjenkins.ContrastPluginConfig.ContrastPluginConfigDescriptor
    profileDescriptor() {
        return j.jenkins.getDescriptorByType(
                com.aspectsecurity.contrast.contrastjenkins.ContrastPluginConfig.ContrastPluginConfigDescriptor.class);
    }

    private void writeProfile() throws Exception {
        com.aspectsecurity.contrast.contrastjenkins.ContrastPluginConfig.ContrastPluginConfigDescriptor descriptor =
                profileDescriptor();
        Field field = descriptor.getClass().getDeclaredField("teamServerProfiles");
        field.setAccessible(true);
        Object list = field.get(descriptor);
        Method add = list.getClass().getMethod("add", Object.class);
        com.aspectsecurity.contrast.contrastjenkins.TeamServerProfile profile =
                new com.aspectsecurity.contrast.contrastjenkins.TeamServerProfile(
                        PROFILE, "profile-user", "api-key-marker", "service-key-marker", ORG,
                        teamServer.apiUrl(), false, "Fail", true);
        profile.setApps(Collections.singletonList(
                new com.aspectsecurity.contrast.contrastjenkins.App(APP_ID, APP_TITLE)));
        profile.setVulnerabilityTypes(Collections.singletonList(
                new com.aspectsecurity.contrast.contrastjenkins.VulnerabilityType(RULE_NAME, RULE_TITLE)));
        add.invoke(list, profile);
        descriptor.save();
    }

    /** The persisted controller-wide configuration file, read without using product helpers. */
    protected byte[] configBytes() {
        try {
            Method m = hudson.model.Descriptor.class.getDeclaredMethod("getConfigFile");
            m.setAccessible(true);
            hudson.XmlFile config = (hudson.XmlFile) m.invoke(profileDescriptor());
            return Files.readAllBytes(config.getFile().toPath());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ---------------------------------------------------------------- HTTP

    protected JenkinsRule.WebClient client(String user) throws Exception {
        JenkinsRule.WebClient cached = clients.get(user);
        if (cached != null) {
            return cached;
        }
        JenkinsRule.WebClient wc = j.createWebClient();
        wc.getOptions().setJavaScriptEnabled(false);
        wc.getOptions().setCssEnabled(false);
        wc.setThrowExceptionOnFailingStatusCode(false);
        wc.setRedirectEnabled(false);
        HtmlPage login = wc.goTo("login");
        HtmlForm form = login.getFormByName("login");
        form.getInputByName("j_username").setValueAttribute(user);
        form.getInputByName("j_password").setValueAttribute(user);
        form.submit(null);
        clients.put(user, wc);
        return wc;
    }

    protected Page get(String path, String user) throws Exception {
        return client(user).getPage(j.getURL() + path);
    }

    protected Page post(String path, String body, String user) throws Exception {
        WebRequest request = new WebRequest(new URL(j.getURL(), path), HttpMethod.POST);
        request.setRequestBody(body);
        request.setAdditionalHeader("Content-Type", "application/x-www-form-urlencoded");
        return client(user).getPage(request);
    }

    protected static int status(Page page) {
        return page.getWebResponse().getStatusCode();
    }

    protected static String body(Page page) {
        return page.getWebResponse().getContentAsString();
    }

    protected static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    protected static String form(String... keyValues) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            if (b.length() > 0) {
                b.append('&');
            }
            b.append(encode(keyValues[i])).append('=').append(encode(keyValues[i + 1]));
        }
        return b.toString();
    }

    // ---------------------------------------------------------------- assertions

    /** A request must be refused: no marker in the body, or a clean client error. */
    protected static void assertNotDisclosed(Page page, String marker, String what) {
        int s = status(page);
        if (s >= 500) {
            fail(what + " failed with a server error (" + s + "), which is not a refusal");
        }
        if (s >= 400) {
            return;
        }
        String text = body(page);
        assertFalse(what + " was disclosed to a user who may not configure it: " + text,
                text.contains(marker));
    }

    protected void assertNoTeamServerContact(String what) {
        assertTrue(what + " caused the controller to contact the TeamServer", teamServer.count() == 0);
    }

    /** A legitimate request must succeed and include the expected entry. */
    protected static void assertContains(Page page, String marker, String what) {
        int s = status(page);
        assertTrue(what + " failed with HTTP " + s, s < 400);
        assertTrue(what + " did not include the expected entry: " + body(page),
                body(page).contains(marker));
    }

    // ---------------------------------------------------------------- loopback TeamServer

    /** Answers every request with an empty application list and records that the plugin made one. */
    protected static final class TeamServerStub {
        private final HttpServer server;
        private final AtomicInteger requests = new AtomicInteger();

        TeamServerStub() throws IOException {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", this::handle);
            server.start();
        }

        private void handle(HttpExchange exchange) throws IOException {
            requests.incrementAndGet();
            // An empty application list, in the shape the client library parses.
            byte[] response = "{\"applications\":[],\"count\":0}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(response);
            } catch (IOException ignored) {
                // the client may have gone away; the count is what matters
            }
        }

        String apiUrl() {
            return "http://127.0.0.1:" + server.getAddress().getPort() + "/Contrast/api";
        }

        int count() {
            return requests.get();
        }

        void reset() {
            requests.set(0);
        }

        void stop() {
            server.stop(0);
        }
    }
}
