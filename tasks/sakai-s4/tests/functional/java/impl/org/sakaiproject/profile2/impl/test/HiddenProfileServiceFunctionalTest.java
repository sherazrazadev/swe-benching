/*
 * Hidden functional checks for the profile service: legitimate profile changes keep working.
 */
package org.sakaiproject.profile2.impl.test;

import static org.junit.Assert.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.Before;
import org.junit.Test;
import org.sakaiproject.api.common.edu.person.SakaiPerson;
import org.sakaiproject.entity.api.EntityManager;
import org.sakaiproject.memory.api.MemoryService;
import org.sakaiproject.profile2.api.ProfileDao;
import org.sakaiproject.profile2.api.ProfileTransferBean;
import org.sakaiproject.profile2.api.SakaiProxy;
import org.sakaiproject.profile2.impl.ProfileServiceImpl;
import org.sakaiproject.tool.api.SessionManager;
import org.sakaiproject.user.api.User;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * A user keeps changing their own profile; an administrator keeps changing other people's. The
 * service must accept both, exactly as before.
 */
public class HiddenProfileServiceFunctionalTest {

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
        when(sakaiProxy.removeResource(anyString())).thenReturn(true);
        when(sakaiProxy.resourceExists(anyString())).thenReturn(false);
        when(sakaiProxy.getSakaiPerson(anyString())).thenReturn(Optional.empty());
        User user = anyUser();
        when(sakaiProxy.getUserById(anyString())).thenReturn(user);
    }

    private static User anyUser() {

        User user = mock(User.class);
        when(user.getEid()).thenReturn("someone");
        when(user.getFirstName()).thenReturn("Some");
        when(user.getLastName()).thenReturn("One");
        when(user.getDisplayName()).thenReturn("Some One");
        when(user.getType()).thenReturn("student");
        when(user.getEmail()).thenReturn("someone@example.invalid");
        when(user.getCreatedBy()).thenReturn(user);
        when(user.getModifiedBy()).thenReturn(user);
        return user;
    }

    @Test
    public void ownerStillRemovesTheirOwnProfileImage() {

        assertTrue(service.removeProfileImage(SELF));

        verify(dao).removeProfileImage(SELF);
    }

    @Test
    public void administratorStillRemovesAnotherProfileImage() {

        when(sakaiProxy.isSuperUser()).thenReturn(true);

        assertTrue(service.removeProfileImage(OTHER));

        verify(dao).removeProfileImage(OTHER);
    }

    @Test
    public void ownerStillSavesTheirOwnProfile() {

        SakaiPerson person = mock(SakaiPerson.class);
        when(sakaiProxy.getSakaiPerson(SELF)).thenReturn(Optional.of(person));
        when(sakaiProxy.updateSakaiPerson(person)).thenReturn(true);

        ProfileTransferBean bean = new ProfileTransferBean();
        bean.id = SELF;
        bean.nickname = "new nickname";

        assertTrue(service.saveUserProfile(bean));

        verify(sakaiProxy).updateSakaiPerson(person);
        verify(dao).saveSocialNetworkingInfo(any());
    }

    @Test
    public void administratorStillSavesAnotherProfile() {

        when(sakaiProxy.isSuperUser()).thenReturn(true);
        SakaiPerson person = mock(SakaiPerson.class);
        when(sakaiProxy.getSakaiPerson(OTHER)).thenReturn(Optional.of(person));
        when(sakaiProxy.updateSakaiPerson(person)).thenReturn(true);

        ProfileTransferBean bean = new ProfileTransferBean();
        bean.id = OTHER;
        bean.nickname = "corrected";

        assertTrue(service.saveUserProfile(bean));

        verify(sakaiProxy).updateSakaiPerson(person);
    }

    @Test
    public void ownerStillRemovesTheirOwnPronunciationRecording() {

        assertTrue(service.removePronunciationRecording(SELF));

        verify(sakaiProxy).removeResource(eq("/private/namePronunciation/" + SELF + ".ogg"));
    }

    @Test
    public void administratorStillRemovesAnotherPronunciationRecording() {

        when(sakaiProxy.isSuperUser()).thenReturn(true);

        assertTrue(service.removePronunciationRecording(OTHER));

        verify(sakaiProxy).removeResource(eq("/private/namePronunciation/" + OTHER + ".ogg"));
    }

    @Test
    public void aUserStillSetsTheirOwnOfficialImageUrl() {

        assertTrue(service.saveOfficialImageUrl(SELF, "https://example.invalid/me.png"));

        verify(dao).saveOfficialImage(any());
    }

    @Test
    public void administratorStillSetsAnotherOfficialImageUrl() {

        when(sakaiProxy.isSuperUser()).thenReturn(true);

        assertTrue(service.saveOfficialImageUrl(OTHER, "https://example.invalid/them.png"));

        verify(dao).saveOfficialImage(any());
    }

    @Test
    public void ownerStillSetsTheirOwnLock() {

        assertTrue(service.setProfileLocked(SELF, true));

        verify(sakaiProxy).toggleProfileLocked(SELF, true);
    }

    @Test
    public void administratorStillSetsAnotherLock() {

        when(sakaiProxy.isSuperUser()).thenReturn(true);

        assertTrue(service.setProfileLocked(OTHER, false));

        verify(sakaiProxy).toggleProfileLocked(OTHER, false);
    }

    @Test
    public void ownerStillSavesTheirOwnSocialLinks() {

        assertTrue(service.saveSocialNetworkingLinks(SELF, "https://example.invalid/me",
                "https://example.invalid/me2", "https://example.invalid/me3"));

        verify(dao).saveSocialNetworkingInfo(any());
    }

    @Test
    public void administratorStillSavesAnotherSocialLinks() {

        when(sakaiProxy.isSuperUser()).thenReturn(true);

        assertTrue(service.saveSocialNetworkingLinks(OTHER, "https://example.invalid/them",
                "https://example.invalid/them2", "https://example.invalid/them3"));

        verify(dao).saveSocialNetworkingInfo(any());
    }
}
