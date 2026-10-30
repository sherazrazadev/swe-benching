/*
 * Hidden security checks for profile mutations made over the web API.
 */
package org.sakaiproject.webapi.controllers.test;

import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.ArrayList;
import java.util.List;

import org.junit.Before;
import org.junit.Test;
import org.sakaiproject.component.api.ServerConfigurationService;
import org.sakaiproject.event.api.EventTrackingService;
import org.sakaiproject.profile2.api.ProfileService;
import org.sakaiproject.profile2.api.ProfileTransferBean;
import org.sakaiproject.tool.api.Session;
import org.sakaiproject.tool.api.SessionManager;
import org.sakaiproject.tool.api.ToolManager;
import org.sakaiproject.user.api.UserDirectoryService;
import org.sakaiproject.webapi.controllers.ProfileController;
import org.sakaiproject.webapi.exception.GlobalExceptionHandler;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * Drives the real profile controller and the real exception advice over HTTP. The profile service
 * is replaced by a stub that answers like the real one must: it allows the signed-in user's own
 * identifier and refuses every other identifier with an error, recording every change it accepts.
 */
public class HiddenProfileSecurityTest {

    private static final String SELF = "user-self";
    private static final String OTHER = "user-other";

    private ProfileService profileService;
    private SessionManager sessionManager;
    private Session session;
    private MockMvc mockMvc;
    private final List<String> acceptedChanges = new ArrayList<>();

    @Before
    public void setUp() {

        acceptedChanges.clear();
        profileService = mock(ProfileService.class);
        sessionManager = mock(SessionManager.class);
        session = mock(Session.class);

        when(sessionManager.getCurrentSession()).thenReturn(session);
        when(session.getUserId()).thenReturn(SELF);

        ProfileController controller = new ProfileController();
        controller.setSessionManager(sessionManager);
        ReflectionTestUtils.setField(controller, "profileService", profileService);
        ReflectionTestUtils.setField(controller, "eventTrackingService", mock(EventTrackingService.class));
        ReflectionTestUtils.setField(controller, "userDirectoryService", mock(UserDirectoryService.class));
        ReflectionTestUtils.setField(controller, "serverConfigurationService", mock(ServerConfigurationService.class));
        ReflectionTestUtils.setField(controller, "toolManager", mock(ToolManager.class));

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

        denyEveryoneButSelf();
    }

    /** The service stub enforces the rule: only the signed-in user's own identifier is allowed. */
    private void denyEveryoneButSelf() {

        doAnswer(invocation -> {
            String target = invocation.getArgument(0);
            String current = session.getUserId();
            if (current == null || !current.equals(target)) {
                throw new SecurityException("Not allowed.");
            }
            acceptedChanges.add("removeProfileImage:" + target);
            return true;
        }).when(profileService).removeProfileImage(anyString());

        doAnswer(invocation -> {
            String target = invocation.getArgument(0);
            String current = session.getUserId();
            if (current == null || !current.equals(target)) {
                throw new SecurityException("Not allowed.");
            }
            acceptedChanges.add("removePronunciationRecording:" + target);
            return true;
        }).when(profileService).removePronunciationRecording(anyString());

        doAnswer(invocation -> {
            String target = invocation.getArgument(0);
            boolean locked = invocation.getArgument(1);
            String current = session.getUserId();
            if (current == null || !current.equals(target)) {
                throw new SecurityException("Not allowed.");
            }
            acceptedChanges.add("setProfileLocked:" + target + ":" + locked);
            return true;
        }).when(profileService).setProfileLocked(anyString(), anyBoolean());

        doAnswer(invocation -> {
            String target = invocation.getArgument(0);
            String current = session.getUserId();
            if (current == null || !current.equals(target)) {
                throw new SecurityException("Not allowed.");
            }
            acceptedChanges.add("links:" + target);
            return true;
        }).when(profileService).saveSocialNetworkingLinks(anyString(), any(), any(), any());

        doAnswer(invocation -> {
            ProfileTransferBean bean = invocation.getArgument(0);
            String current = session.getUserId();
            if (current == null || !current.equals(bean.id)) {
                throw new SecurityException("Not allowed.");
            }
            acceptedChanges.add("saveUserProfile:" + bean.id);
            return true;
        }).when(profileService).saveUserProfile(any(ProfileTransferBean.class));
    }

    private static void assertClientErrorAndNoChange(MvcResult result, List<String> accepted) {

        int status = result.getResponse().getStatus();
        assertTrue("expected a client error, got " + status, status >= 400 && status < 500);
        assertTrue("the change was applied: " + accepted, accepted.isEmpty());
    }

    @Test
    public void patchCannotMoveTheChangeToAnotherProfile() throws Exception {

        ProfileTransferBean presented = new ProfileTransferBean();
        presented.id = OTHER;
        when(profileService.getUserProfile(OTHER)).thenReturn(presented);

        MvcResult result = mockMvc.perform(patch("/users/" + OTHER + "/profile")
                .contentType("application/json-patch+json")
                .content("[{\"op\":\"replace\",\"path\":\"/nickname\",\"value\":\"changed\"}]"))
            .andReturn();

        assertClientErrorAndNoChange(result, acceptedChanges);
    }

    @Test
    public void patchCannotRewriteTheSavedIdentity() throws Exception {

        ProfileTransferBean own = new ProfileTransferBean();
        own.id = SELF;
        when(profileService.getUserProfile(SELF)).thenReturn(own);

        MvcResult result = mockMvc.perform(patch("/users/" + SELF + "/profile")
                .contentType("application/json-patch+json")
                .content("[{\"op\":\"replace\",\"path\":\"/id\",\"value\":\"" + OTHER + "\"},"
                    + "{\"op\":\"replace\",\"path\":\"/nickname\",\"value\":\"changed\"}]"))
            .andReturn();

        assertClientErrorAndNoChange(result, acceptedChanges);
    }

    @Test
    public void deleteImageCannotTargetAnotherProfile() throws Exception {

        MvcResult result = mockMvc.perform(delete("/users/" + OTHER + "/profile/image")).andReturn();

        assertClientErrorAndNoChange(result, acceptedChanges);
    }

    @Test
    public void deletePronunciationCannotTargetAnotherProfile() throws Exception {

        MvcResult result = mockMvc.perform(delete("/users/" + OTHER + "/profile/pronunciation")).andReturn();

        assertClientErrorAndNoChange(result, acceptedChanges);
    }

    @Test
    public void deletePronunciationWithoutASessionIsRefused() throws Exception {

        when(session.getUserId()).thenReturn(null);

        MvcResult result = mockMvc.perform(delete("/users/" + OTHER + "/profile/pronunciation")).andReturn();

        assertClientErrorAndNoChange(result, acceptedChanges);
    }

    @Test
    public void lockCannotTargetAnotherProfile() throws Exception {

        MvcResult result = mockMvc.perform(post("/users/" + OTHER + "/profile/lock")
                .param("locked", "true")).andReturn();

        assertClientErrorAndNoChange(result, acceptedChanges);
    }

    @Test
    public void socialLinksCannotTargetAnotherProfile() throws Exception {

        MvcResult result = mockMvc.perform(post("/users/" + OTHER + "/profile/social")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"facebookUrl\":\"https://example.invalid/attacker\"}")).andReturn();

        assertClientErrorAndNoChange(result, acceptedChanges);
    }
}
