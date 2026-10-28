package bench.security;

import bench.EventsFixture;
import bench.Refusal;
import bench.Shares;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.verifyNoInteractions;

/** Changing an existing event notification's sharing through its update request is owner-only. */
public class SecurityEventNotificationsSharingTest {
    private static final String NOTIFICATION = "bench-notification";

    @Test
    public void editorWithoutOwnershipCannotShareNotification() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.NotificationResource resource = fixture.notification(NOTIFICATION);

        Refusal.assertClientError(() -> resource.update(Shares.grant("intruder")));
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void editorWithoutOwnershipCannotRemoveEveryNotificationShare() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.NotificationResource resource = fixture.notification(NOTIFICATION);

        Refusal.assertClientError(() -> resource.update(Shares.unshareAll()));
        verifyNoInteractions(fixture.shares);
    }
}
