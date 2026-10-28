package bench.security;

import bench.Refusal;
import bench.Shares;
import bench.ViewsFixture;
import org.graylog.plugins.views.search.views.ViewDTO;
import org.graylog.security.Capability;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.verifyNoInteractions;

/** Changing an existing view's sharing through its update request is owner-only. */
public class SecurityViewsSharingTest {
    private static final String TARGET = "bench-view-target";
    private static final String OTHER = "bench-view-other";

    private static ViewsFixture editorWith(ViewDTO.Type type) {
        final ViewsFixture fixture = new ViewsFixture();
        fixture.allowEdit(TARGET, type);
        fixture.existing(TARGET, type);
        return fixture;
    }

    @Test
    public void editorWithoutOwnershipCannotShareDashboard() {
        final ViewsFixture fixture = editorWith(ViewDTO.Type.DASHBOARD);
        Refusal.assertClientError(() ->
                fixture.update(TARGET, fixture.view(TARGET, ViewDTO.Type.DASHBOARD), Shares.grant("intruder")));
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void editorWithoutOwnershipCannotShareSavedSearch() {
        final ViewsFixture fixture = editorWith(ViewDTO.Type.SEARCH);
        Refusal.assertClientError(() ->
                fixture.update(TARGET, fixture.view(TARGET, ViewDTO.Type.SEARCH), Shares.grant("intruder")));
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void editorWithoutOwnershipCannotRemoveEveryShare() {
        final ViewsFixture fixture = editorWith(ViewDTO.Type.DASHBOARD);
        Refusal.assertClientError(() ->
                fixture.update(TARGET, fixture.view(TARGET, ViewDTO.Type.DASHBOARD), Shares.unshareAll()));
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void editorWithoutOwnershipCannotGrantTheOwnerCapability() {
        final ViewsFixture fixture = editorWith(ViewDTO.Type.DASHBOARD);
        Refusal.assertClientError(() ->
                fixture.update(TARGET, fixture.view(TARGET, ViewDTO.Type.DASHBOARD),
                        Shares.grant("intruder", Capability.OWN)));
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void editorCannotShareByNamingAnotherViewInTheBody() {
        final ViewsFixture fixture = new ViewsFixture();
        fixture.allowEdit(TARGET, ViewDTO.Type.DASHBOARD);
        fixture.existing(TARGET, ViewDTO.Type.DASHBOARD);
        // The caller owns OTHER; the request updates TARGET's sharing.
        fixture.authority.own(fixture.grn(OTHER, ViewDTO.Type.DASHBOARD));

        Refusal.assertClientError(() ->
                fixture.update(TARGET, fixture.view(OTHER, ViewDTO.Type.DASHBOARD), Shares.grant("intruder")));
        verifyNoInteractions(fixture.shares);
    }
}
