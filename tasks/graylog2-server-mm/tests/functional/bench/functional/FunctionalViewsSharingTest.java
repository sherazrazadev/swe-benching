package bench.functional;

import bench.Shares;
import bench.ViewsFixture;
import org.graylog.grn.GRNType;
import org.graylog.grn.GRNTypes;
import org.graylog.plugins.views.search.views.ViewDTO;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/** Legitimate dashboard and saved-search use must keep working exactly as before. */
public class FunctionalViewsSharingTest {
    private static final String TARGET = "bench-view-target";

    private static ViewsFixture ownerOf(ViewDTO.Type type) {
        final ViewsFixture fixture = new ViewsFixture();
        fixture.allowEdit(TARGET, type);
        fixture.existing(TARGET, type);
        fixture.authority.own(fixture.grn(TARGET, type));
        return fixture;
    }

    @Test
    public void ownerCanShareDashboardOnUpdate() {
        final ViewsFixture fixture = ownerOf(ViewDTO.Type.DASHBOARD);

        assertThatCode(() -> fixture.update(TARGET,
                fixture.view(TARGET, ViewDTO.Type.DASHBOARD), Shares.grant("teammate")))
                .doesNotThrowAnyException();

        final ArgumentCaptor<GRNType> type = ArgumentCaptor.forClass(GRNType.class);
        verify(fixture.shares).updateEntityShares(type.capture(), eq(TARGET), any(), any());
        assertThat(type.getValue()).isEqualTo(GRNTypes.DASHBOARD);
    }

    @Test
    public void ownerCanShareSavedSearchOnUpdate() {
        final ViewsFixture fixture = ownerOf(ViewDTO.Type.SEARCH);

        assertThatCode(() -> fixture.update(TARGET,
                fixture.view(TARGET, ViewDTO.Type.SEARCH), Shares.grant("teammate")))
                .doesNotThrowAnyException();

        final ArgumentCaptor<GRNType> type = ArgumentCaptor.forClass(GRNType.class);
        verify(fixture.shares).updateEntityShares(type.capture(), eq(TARGET), any(), any());
        assertThat(type.getValue()).isEqualTo(GRNTypes.SEARCH);
    }

    @Test
    public void ownerCanRemoveEveryShareOnUpdate() {
        final ViewsFixture fixture = ownerOf(ViewDTO.Type.DASHBOARD);

        assertThatCode(() -> fixture.update(TARGET,
                fixture.view(TARGET, ViewDTO.Type.DASHBOARD), Shares.unshareAll()))
                .doesNotThrowAnyException();

        verify(fixture.shares).updateEntityShares(eq(GRNTypes.DASHBOARD), eq(TARGET), any(), any());
    }

    @Test
    public void editorCanSaveContentWithoutASharingInstruction() {
        final ViewsFixture fixture = new ViewsFixture();
        fixture.allowEdit(TARGET, ViewDTO.Type.DASHBOARD);
        fixture.existing(TARGET, ViewDTO.Type.DASHBOARD);

        assertThatCode(() -> fixture.update(TARGET,
                fixture.view(TARGET, ViewDTO.Type.DASHBOARD), null))
                .doesNotThrowAnyException();

        verify(fixture.viewService).update(any());
        verifyNoInteractions(fixture.shares);
    }

    @Test
    public void creatingAViewWithSharingStillSharesIt() {
        final ViewsFixture fixture = new ViewsFixture();
        fixture.allowCreate(ViewDTO.Type.DASHBOARD);

        fixture.create("bench-created-view", ViewDTO.Type.DASHBOARD, Shares.grant("teammate"));

        verify(fixture.shares).updateEntityShares(eq(GRNTypes.DASHBOARD), eq("bench-created-view"), any(), any());
    }

    @Test
    public void duplicatingAViewWithSharingStillSharesTheCopy() {
        final ViewsFixture fixture = new ViewsFixture();
        fixture.allowCreate(ViewDTO.Type.SEARCH);

        fixture.duplicate("bench-original", "bench-copy", ViewDTO.Type.SEARCH, Shares.grant("teammate"));

        verify(fixture.shares).updateEntityShares(eq(GRNTypes.SEARCH), eq("bench-copy"), any(), any());
    }
}
