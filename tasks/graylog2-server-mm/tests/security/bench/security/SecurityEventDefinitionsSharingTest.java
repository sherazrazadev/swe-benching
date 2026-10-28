package bench.security;

import bench.EventsFixture;
import bench.Refusal;
import bench.Shares;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.verifyNoInteractions;

/** Changing an existing event definition's sharing through its update request is owner-only. */
public class SecurityEventDefinitionsSharingTest {
    private static final String DEFINITION = "bench-event-definition";

    @Test
    public void editorWithoutOwnershipCannotShareEventDefinition() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.DefinitionResource resource = fixture.definition(DEFINITION);

        Refusal.assertClientError(() -> resource.update(Shares.grant("intruder")));
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void editorWithoutOwnershipCannotRemoveEveryEventDefinitionShare() {
        final EventsFixture fixture = new EventsFixture();
        final EventsFixture.DefinitionResource resource = fixture.definition(DEFINITION);

        Refusal.assertClientError(() -> resource.update(Shares.unshareAll()));
        verifyNoInteractions(fixture.shares);
    }
}
