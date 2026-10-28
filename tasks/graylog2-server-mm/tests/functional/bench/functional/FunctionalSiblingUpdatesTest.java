package bench.functional;

import bench.EventsFixture;
import bench.Shares;
import bench.StreamsFixture;
import org.graylog.grn.GRNTypes;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/** Owners may still share these objects on update; editors may still save them without sharing. */
public class FunctionalSiblingUpdatesTest {
    private static final String DEFINITION = "bench-event-definition";
    private static final String NOTIFICATION = "bench-notification";
    private static final String STREAM = "bench-stream-id";

    @Test
    public void ownerCanShareEventDefinitionOnUpdate() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.DefinitionResource resource = fixture.definition(DEFINITION);
        fixture.authority.own(GRNTypes.EVENT_DEFINITION.toGRN(DEFINITION));

        assertThatCode(() -> resource.update(Shares.grant("teammate"))).doesNotThrowAnyException();
        verify(fixture.shares).updateEntityShares(eq(GRNTypes.EVENT_DEFINITION), eq(DEFINITION), any(), any());
    }

    @Test
    public void editorCanUpdateEventDefinitionWithoutSharing() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.DefinitionResource resource = fixture.definition(DEFINITION);

        assertThatCode(() -> resource.update(null)).doesNotThrowAnyException();
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void ownerCanShareNotificationOnUpdate() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.NotificationResource resource = fixture.notification(NOTIFICATION);
        fixture.authority.own(GRNTypes.EVENT_NOTIFICATION.toGRN(NOTIFICATION));

        assertThatCode(() -> resource.update(Shares.grant("teammate"))).doesNotThrowAnyException();
        verify(fixture.shares).updateEntityShares(eq(GRNTypes.EVENT_NOTIFICATION), eq(NOTIFICATION), any(), any());
    }

    @Test
    public void editorCanUpdateNotificationWithoutSharing() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.NotificationResource resource = fixture.notification(NOTIFICATION);

        assertThatCode(() -> resource.update(null)).doesNotThrowAnyException();
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void ownerCanShareStreamOnUpdate() throws Exception {
        final StreamsFixture fixture = new StreamsFixture();
        fixture.existing(STREAM);
        fixture.authority.own(GRNTypes.STREAM.toGRN(STREAM));

        assertThatCode(() -> fixture.update(STREAM, Shares.grant("teammate"))).doesNotThrowAnyException();
        verify(fixture.shares).updateEntityShares(eq(GRNTypes.STREAM), eq(STREAM), any(), any());
    }

    @Test
    public void editorCanUpdateStreamWithoutSharing() throws Exception {
        final StreamsFixture fixture = new StreamsFixture();
        fixture.existing(STREAM);

        assertThatCode(() -> fixture.update(STREAM, null)).doesNotThrowAnyException();
        verifyNoInteractions(fixture.shares);
    }
}
