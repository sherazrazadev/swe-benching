/*
 * Hidden security checks for profile changes made through the profile service.
 */
package org.sakaiproject.profile2.impl.test;

import static org.junit.Assert.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.Before;
import org.junit.Test;
import org.sakaiproject.entity.api.EntityManager;
import org.sakaiproject.memory.api.MemoryService;
import org.sakaiproject.profile2.api.ProfileDao;
import org.sakaiproject.profile2.api.ProfileTransferBean;
import org.sakaiproject.profile2.api.SakaiProxy;
import org.sakaiproject.profile2.impl.ProfileServiceImpl;
import org.sakaiproject.tool.api.SessionManager;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Exercises the real profile service with its collaborators replaced by mocks. Every attempt to
 * change another user's profile must raise an error before any collaborator is asked to write.
 */
public class HiddenProfileServiceSecurityTest {

    private static final String SELF = "user-self";
    private static final String OTHER = "user-other";

    private ProfileServiceImpl service;
    private ProfileDao dao;
    private SakaiProxy sakaiProxy;
    private SessionManager sessionManager;

    @Before
    public void setUp() {

        service = new ProfileServiceImpl();
        dao = mock(ProfileDao.class);
        sakaiProxy = mock(SakaiProxy.class);
        sessionManager = mock(SessionManager.class);

        ReflectionTestUtils.setField(service, "dao", dao);
        ReflectionTestUtils.setField(service, "sakaiProxy", sakaiProxy);
        ReflectionTestUtils.setField(service, "sessionManager", sessionManager);
        ReflectionTestUtils.setField(service, "entityManager", mock(EntityManager.class));
        ReflectionTestUtils.setField(service, "memoryService", mock(MemoryService.class));

        when(sakaiProxy.getCurrentUserId()).thenReturn(SELF);
        when(sessionManager.getCurrentSessionUserId()).thenReturn(SELF);
        when(dao.getSocialNetworkingInfo(anyString())).thenReturn(Optional.empty());
        when(dao.saveSocialNetworkingInfo(any())).thenReturn(true);
        when(dao.saveOfficialImage(any())).thenReturn(true);
        when(dao.removeProfileImage(anyString())).thenReturn(true);
        when(sakaiProxy.toggleProfileLocked(anyString(), anyBoolean())).thenReturn(true);
    }

    private static void assertRefused(Runnable change) {

        try {
            change.run();
            fail("the change of another user's profile was accepted");
        } catch (RuntimeException expected) {
            // refused
        }
    }

    private static ProfileTransferBean profileOf(String id) {

        ProfileTransferBean bean = new ProfileTransferBean();
        bean.id = id;
        bean.nickname = "changed";
        return bean;
    }

    @Test
    public void removeProfileImageRefusesAnotherUser() {

        assertRefused(() -> service.removeProfileImage(OTHER));

        verify(dao, never()).removeProfileImage(anyString());
    }

    @Test
    public void saveUserProfileRefusesAnotherUser() {

        assertRefused(() -> service.saveUserProfile(profileOf(OTHER)));

        verify(sakaiProxy, never()).updateSakaiPerson(any());
        verify(dao, never()).saveSocialNetworkingInfo(any());
    }

    @Test
    public void saveUserProfileRefusesWhenThereIsNoSession() {

        when(sakaiProxy.getCurrentUserId()).thenReturn(null);

        assertRefused(() -> service.saveUserProfile(profileOf(SELF)));

        verify(sakaiProxy, never()).updateSakaiPerson(any());
        verify(dao, never()).saveSocialNetworkingInfo(any());
    }

    @Test
    public void removePronunciationRecordingRefusesAnotherUser() {

        assertRefused(() -> service.removePronunciationRecording(OTHER));

        verify(sakaiProxy, never()).removeResource(anyString());
        verify(dao, never()).saveSocialNetworkingInfo(any());
    }

    @Test
    public void saveOfficialImageUrlRefusesAnotherUser() {

        assertRefused(() -> service.saveOfficialImageUrl(OTHER, "https://example.invalid/attacker.png"));

        verify(dao, never()).saveOfficialImage(any());
    }

    @Test
    public void setProfileLockedRefusesAnotherUser() {

        assertRefused(() -> service.setProfileLocked(OTHER, true));

        verify(sakaiProxy, never()).toggleProfileLocked(anyString(), anyBoolean());
    }

    @Test
    public void saveSocialNetworkingLinksRefusesAnotherUser() {

        assertRefused(() -> service.saveSocialNetworkingLinks(OTHER, "https://example.invalid/a",
                "https://example.invalid/b", "https://example.invalid/c"));

        verify(dao, never()).saveSocialNetworkingInfo(any());
    }
}
