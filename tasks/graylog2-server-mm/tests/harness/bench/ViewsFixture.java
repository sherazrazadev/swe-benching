package bench;

import com.google.common.collect.ImmutableSet;
import org.apache.shiro.subject.Subject;
import org.graylog.grn.GRN;
import org.graylog.grn.GRNTypes;
import org.graylog.plugins.views.search.Search;
import org.graylog.plugins.views.search.SearchDomain;
import org.graylog.plugins.views.search.permissions.SearchUser;
import org.graylog.plugins.views.search.rest.PermittedStreams;
import org.graylog.plugins.views.search.rest.ViewsResource;
import org.graylog.plugins.views.search.rest.ViewsRestPermissions;
import org.graylog.plugins.views.search.searchfilters.ReferencedSearchFiltersHelper;
import org.graylog.plugins.views.search.searchfilters.db.SearchFilterVisibilityChecker;
import org.graylog.plugins.views.search.views.ViewDTO;
import org.graylog.plugins.views.search.views.ViewService;
import org.graylog.plugins.views.startpage.StartPageService;
import org.graylog.plugins.views.startpage.recentActivities.RecentActivityService;
import org.graylog.security.UserContext;
import org.graylog.security.shares.CreateEntityRequest;
import org.graylog.security.shares.EntityShareRequest;
import org.graylog.security.shares.EntitySharesService;
import org.graylog2.audit.AuditEventSender;
import org.graylog2.database.entities.source.EntitySourceService;
import org.graylog2.events.ClusterEventBus;
import org.graylog2.plugin.database.users.User;
import org.graylog2.shared.security.RestPermissions;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Builds a real ViewsResource over stubbed collaborators, with a per-verb authority. */
public final class ViewsFixture {
    public static final String SEARCH_ID = "6141d457d3a6b9d73c8ac55a";

    public final FakeAuthority authority = new FakeAuthority();
    public final ViewService viewService = mock(ViewService.class);
    public final EntitySharesService shares = mock(EntitySharesService.class);
    public final UserContext userContext = mock(UserContext.class);
    public final User user = mock(User.class);
    public final ViewsResource resource;
    public final SearchUser searchUser;

    public ViewsFixture() {
        when(user.getName()).thenReturn("bench-editor");
        when(userContext.getUser()).thenReturn(user);

        final Set<String> permissions = new HashSet<>();
        this.searchUser = new SearchUser(
                user,
                permission -> permissions.contains(permission) || authority.subject().isPermitted(permission),
                (permission, id) -> permissions.contains(permission + ":" + id)
                        || authority.subject().isPermitted(permission + ":" + id),
                new PermittedStreams(() -> Stream.empty(), categories -> Stream.empty(), List::of),
                Map.of());

        final Search search = Search.builder().id(SEARCH_ID).queries(ImmutableSet.of()).build();
        final SearchDomain searchDomain = mock(SearchDomain.class);
        when(searchDomain.getForUser(eq(SEARCH_ID), any())).thenReturn(Optional.of(search));

        this.resource = new ViewsResource(
                viewService,
                mock(StartPageService.class),
                mock(RecentActivityService.class),
                mock(ClusterEventBus.class),
                searchDomain,
                Map.of(),
                new SearchFilterVisibilityChecker(),
                new ReferencedSearchFiltersHelper(),
                mock(AuditEventSender.class),
                mock(com.fasterxml.jackson.databind.ObjectMapper.class),
                shares,
                mock(EntitySourceService.class)) {
            @Override
            protected Subject getSubject() {
                return ViewsFixture.this.authority.subject();
            }

            @Override
            protected User getCurrentUser() {
                return ViewsFixture.this.user;
            }
        };
        this.permissions = permissions;
    }

    private final Set<String> permissions;

    /** Give the caller edit rights (not ownership) over an existing view. */
    public ViewsFixture allowEdit(String viewId, ViewDTO.Type type) {
        permissions.add((type == ViewDTO.Type.DASHBOARD
                ? RestPermissions.DASHBOARDS_EDIT
                : ViewsRestPermissions.VIEW_EDIT) + ":" + viewId);
        return this;
    }

    public ViewsFixture allowCreate(ViewDTO.Type type) {
        permissions.add(type == ViewDTO.Type.DASHBOARD
                ? RestPermissions.DASHBOARDS_CREATE
                : ViewsRestPermissions.VIEW_CREATE);
        return this;
    }

    public ViewDTO view(String id, ViewDTO.Type type) {
        return ViewDTO.builder()
                .id(id)
                .title("bench")
                .searchId(SEARCH_ID)
                .state(Collections.emptyMap())
                .type(type)
                .build();
    }

    /** Register an existing persisted view that can be updated. */
    public ViewDTO existing(String id, ViewDTO.Type type) {
        final ViewDTO view = view(id, type);
        when(viewService.get(id)).thenReturn(Optional.of(view));
        when(viewService.update(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return view;
    }

    public GRN grn(String id, ViewDTO.Type type) {
        return (type == ViewDTO.Type.DASHBOARD ? GRNTypes.DASHBOARD : GRNTypes.SEARCH).toGRN(id);
    }

    public void update(String pathId, ViewDTO bodyEntity, EntityShareRequest share) {
        resource.update(pathId, CreateEntityRequest.create(bodyEntity, share), searchUser);
    }

    public ViewDTO create(String newId, ViewDTO.Type type, EntityShareRequest share) {
        when(viewService.saveWithOwner(any(), any())).thenReturn(view(newId, type));
        return resource.create(CreateEntityRequest.create(view(null, type), share), userContext, searchUser);
    }

    public ViewDTO duplicate(String existingId, String newId, ViewDTO.Type type, EntityShareRequest share) {
        when(viewService.saveWithOwner(any(), any())).thenReturn(view(newId, type));
        return resource.duplicate(existingId, CreateEntityRequest.create(view(null, type), share), userContext, searchUser);
    }
}
