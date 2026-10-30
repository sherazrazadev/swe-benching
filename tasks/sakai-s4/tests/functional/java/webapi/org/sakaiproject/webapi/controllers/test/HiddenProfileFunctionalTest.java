/*
 * Hidden functional checks for the profile web API: legitimate profile changes keep working.
 */
package org.sakaiproject.webapi.controllers.test;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.ArrayList;
import java.util.List;

import org.junit.Before;
import org.junit.Test;
import org.sakaiproject.component.api.ServerConfigurationService;
import org.sakaiproject.event.api.EventTrackingService;
import org.sakaiproject.profile2.api.MimeTypeByteArray;
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
 * The service stub accepts every change, as it must for the signed-in user on their own profile and
 * for an administrator acting on someone else's. The checks assert the requests still succeed and
 * carry the identifier they are meant to.
 */
public class HiddenProfileFunctionalTest {

    private static final String SELF = "user-self";
    private static final String OTHER = "user-other";
    private static final String ADMIN = "site-admin";

    private static final byte[] RECORDING = new byte[] { 0x4f, 0x67, 0x67, 0x53, 0x00 };

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

        acceptEverything();
    }

    private void acceptEverything() {

        doAnswer(invocation -> {
            acceptedChanges.add("removeProfileImage:" + invocation.getArgument(0));
            return true;
        }).when(profileService).removeProfileImage(anyString());

        doAnswer(invocation -> {
            acceptedChanges.add("removePronunciationRecording:" + invocation.getArgument(0));
            return true;
        }).when(profileService).removePronunciationRecording(anyString());

        doAnswer(invocation -> {
            acceptedChanges.add("setProfileLocked:" + invocation.getArgument(0) + ":" + invocation.getArgument(1));
            return true;
        }).when(profileService).setProfileLocked(anyString(), anyBoolean());

        doAnswer(invocation -> {
            acceptedChanges.add("links:" + invocation.getArgument(0));
            return true;
        }).when(profileService).saveSocialNetworkingLinks(anyString(), any(), any(), any());

        doAnswer(invocation -> {
            ProfileTransferBean bean = invocation.getArgument(0);
            acceptedChanges.add("saveUserProfile:" + bean.id);
            return true;
        }).when(profileService).saveUserProfile(any(ProfileTransferBean.class));
    }

    private static ProfileTransferBean profileOf(String id) {

        ProfileTransferBean bean = new ProfileTransferBean();
        bean.id = id;
        return bean;
    }

    private static void assertOk(MvcResult result) {

        int status = result.getResponse().getStatus();
        assertTrue("expected success, got " + status, status == 200);
    }

    @Test
    public void ownerStillPatchesTheirOwnProfile() throws Exception {

        when(profileService.getUserProfile(SELF)).thenReturn(profileOf(SELF));

        MvcResult result = mockMvc.perform(patch("/users/" + SELF + "/profile")
                .contentType("application/json-patch+json")
                .content("[{\"op\":\"replace\",\"path\":\"/nickname\",\"value\":\"new nickname\"}]"))
            .andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("saveUserProfile:" + SELF));
    }

    @Test
    public void ownerStillPatchesTheirOwnIdentityValue() throws Exception {

        when(profileService.getUserProfile(SELF)).thenReturn(profileOf(SELF));

        MvcResult result = mockMvc.perform(patch("/users/" + SELF + "/profile")
                .contentType("application/json-patch+json")
                .content("[{\"op\":\"replace\",\"path\":\"/id\",\"value\":\"" + SELF + "\"}]"))
            .andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("saveUserProfile:" + SELF));
    }

    @Test
    public void administratorStillPatchesAnotherProfile() throws Exception {

        when(session.getUserId()).thenReturn(ADMIN);
        when(profileService.getUserProfile(OTHER)).thenReturn(profileOf(OTHER));

        MvcResult result = mockMvc.perform(patch("/users/" + OTHER + "/profile")
                .contentType("application/json-patch+json")
                .content("[{\"op\":\"replace\",\"path\":\"/nickname\",\"value\":\"corrected\"}]"))
            .andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("saveUserProfile:" + OTHER));
    }

    @Test
    public void ownerStillRemovesTheirOwnImage() throws Exception {

        MvcResult result = mockMvc.perform(delete("/users/" + SELF + "/profile/image")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("removeProfileImage:" + SELF));
    }

    @Test
    public void administratorStillRemovesAnotherImage() throws Exception {

        when(session.getUserId()).thenReturn(ADMIN);

        MvcResult result = mockMvc.perform(delete("/users/" + OTHER + "/profile/image")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("removeProfileImage:" + OTHER));
    }

    @Test
    public void ownerStillRemovesTheirOwnPronunciationRecording() throws Exception {

        MvcResult result = mockMvc.perform(delete("/users/" + SELF + "/profile/pronunciation")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(),
                acceptedChanges.contains("removePronunciationRecording:" + SELF));
    }

    @Test
    public void administratorStillRemovesAnotherPronunciationRecording() throws Exception {

        when(session.getUserId()).thenReturn(ADMIN);

        MvcResult result = mockMvc.perform(delete("/users/" + OTHER + "/profile/pronunciation")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(),
                acceptedChanges.contains("removePronunciationRecording:" + OTHER));
    }

    @Test
    public void anotherPersonsPronunciationRecordingStaysReadable() throws Exception {

        MimeTypeByteArray data = new MimeTypeByteArray();
        data.setMimeType("audio/ogg");
        data.setBytes(RECORDING);
        when(profileService.getUserNamePronunciation(OTHER)).thenReturn(data);

        MvcResult result = mockMvc.perform(get("/users/" + OTHER + "/profile/pronunciation")).andReturn();

        assertOk(result);
        assertArrayEquals(RECORDING, result.getResponse().getContentAsByteArray());
    }

    @Test
    public void ownerStillSetsTheirOwnLock() throws Exception {

        MvcResult result = mockMvc.perform(post("/users/" + SELF + "/profile/lock")
                .param("locked", "true")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("setProfileLocked:" + SELF + ":true"));
    }

    @Test
    public void administratorStillSetsAnotherLock() throws Exception {

        when(session.getUserId()).thenReturn(ADMIN);

        MvcResult result = mockMvc.perform(post("/users/" + OTHER + "/profile/lock")
                .param("locked", "false")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("setProfileLocked:" + OTHER + ":false"));
    }

    @Test
    public void ownerStillSavesTheirOwnSocialLinks() throws Exception {

        MvcResult result = mockMvc.perform(post("/users/" + SELF + "/profile/social")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"facebookUrl\":\"https://example.invalid/me\"}")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("links:" + SELF));
    }

    @Test
    public void administratorStillSavesAnotherSocialLinks() throws Exception {

        when(session.getUserId()).thenReturn(ADMIN);

        MvcResult result = mockMvc.perform(post("/users/" + OTHER + "/profile/social")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"linkedinUrl\":\"https://example.invalid/them\"}")).andReturn();

        assertOk(result);
        assertTrue(acceptedChanges.toString(), acceptedChanges.contains("links:" + OTHER));
    }
}
