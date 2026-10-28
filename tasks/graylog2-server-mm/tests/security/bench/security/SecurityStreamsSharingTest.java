package bench.security;

import bench.Refusal;
import bench.Shares;
import bench.StreamsFixture;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.verifyNoInteractions;

/** Changing an existing stream's sharing through its update request is owner-only. */
public class SecurityStreamsSharingTest {
    private static final String STREAM = "bench-stream-id";

    @Test
    public void editorWithoutOwnershipCannotShareStream() throws Exception {
        final StreamsFixture fixture = new StreamsFixture();
        fixture.existing(STREAM);

        Refusal.assertClientError(() -> fixture.update(STREAM, Shares.grant("intruder")));
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void editorWithoutOwnershipCannotRemoveEveryStreamShare() throws Exception {
        final StreamsFixture fixture = new StreamsFixture();
        fixture.existing(STREAM);

        Refusal.assertClientError(() -> fixture.update(STREAM, Shares.unshareAll()));
        verifyNoInteractions(fixture.shares);
    }
}
