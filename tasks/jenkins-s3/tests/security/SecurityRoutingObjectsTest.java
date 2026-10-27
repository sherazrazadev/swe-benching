package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import hudson.Plugin;
import hudson.model.ListView;
import hudson.model.ViewProperty;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.jvnet.hudson.test.JenkinsRule;
import org.jvnet.hudson.test.junit.jupiter.WithJenkins;

/**
 * Objects that exist only to route requests or to describe a plugin must never be recreated
 * from a submitted configuration document, even under a field that admits any value.
 */
@WithJenkins
public class SecurityRoutingObjectsTest {

    private static PayloadProperty submit(JenkinsRule j, String viewName, String payloadElement) throws Exception {
        ListView view = new ListView(viewName);
        j.jenkins.addView(view);
        String xml = "<hudson.model.ListView><name>" + viewName + "</name><properties>"
                + "<bench.PayloadProperty><label>kept</label>"
                + payloadElement
                + "</bench.PayloadProperty>"
                + "</properties></hudson.model.ListView>";
        int status = Support.postXml(j, "view/" + viewName + "/config.xml", xml);
        assertTrue(status < 500, "the server failed while processing the document: " + status);
        if (status >= 300) {
            assertEquals(0, view.getProperties().size(), "a refused document must not be applied");
            return null;
        }
        List<ViewProperty> properties = view.getProperties();
        assertEquals(1, properties.size(), "the legitimate carrying property must still be applied");
        return (PayloadProperty) properties.get(0);
    }

    @Test
    void requestRedirectionIsNotRecreated(JenkinsRule j) throws Exception {
        Support.secure(j);
        PayloadProperty property = submit(j, "redirect-view",
                "<payload class=\"jenkins.security.ResourceDomainRootAction$Redirection\">"
                        + "<url>http://example.invalid/</url>"
                        + "</payload>");
        if (property != null) {
            assertNull(property.payload, "an internal request-redirection object was recreated from configuration");
        }
    }

    @Test
    void internalResourceRequestIsNotRecreated(JenkinsRule j) throws Exception {
        Support.secure(j);
        PayloadProperty property = submit(j, "request-view",
                "<payload class=\"jenkins.security.ResourceDomainRootAction$InternalResourceRequest\">"
                        + "<authenticationName>admin</authenticationName>"
                        + "<browserUrl>/scriptText</browserUrl>"
                        + "</payload>");
        if (property != null) {
            assertNull(property.payload, "an internal request-routing object was recreated from configuration");
        }
    }

    @Test
    void pluginWrapperIsNotRecreated(JenkinsRule j) throws Exception {
        Support.secure(j);
        PayloadProperty property = submit(j, "plugin-view",
                "<payload class=\"hudson.Plugin$DummyImpl\">"
                        + "<wrapper class=\"hudson.PluginWrapper\">"
                        + "<baseResourceURL>file:///tmp/</baseResourceURL>"
                        + "</wrapper>"
                        + "</payload>");
        if (property != null) {
            assertTrue(property.payload instanceof Plugin,
                    "the legitimate plugin element must still be applied");
            assertNull(((Plugin) property.payload).getWrapper(),
                    "a plugin-wrapper object was recreated from configuration");
        }
    }
}
