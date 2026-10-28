package bench;

import org.apache.shiro.subject.Subject;
import org.graylog.plugins.views.startpage.recentActivities.RecentActivityService;
import org.graylog.security.UserContext;
import org.graylog.security.shares.CreateEntityRequest;
import org.graylog.security.shares.EntityShareRequest;
import org.graylog.security.shares.EntitySharesService;
import org.graylog2.audit.AuditEventSender;
import org.graylog2.indexer.indexset.registry.IndexSetRegistry;
import org.graylog2.plugin.database.users.User;
import org.graylog2.plugin.streams.Stream;
import org.graylog2.rest.models.streams.requests.UpdateStreamRequest;
import org.graylog2.rest.resources.streams.StreamResource;
import org.graylog2.shared.security.RestPermissions;
import org.graylog2.streams.PaginatedStreamService;
import org.graylog.plugins.pipelineprocessor.db.PipelineService;
import org.graylog2.streams.StreamRuleService;
import org.graylog2.streams.StreamService;
import org.graylog2.streams.filters.StreamDestinationFilterService;
import org.graylog.plugins.pipelineprocessor.db.PipelineStreamConnectionsService;
import org.graylog2.streams.StreamRouterEngine;
import org.graylog2.plugin.MessageFactory;
import org.joda.time.DateTime;

import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Builds a real StreamResource over stubbed collaborators. */
public final class StreamsFixture {
    public final FakeAuthority authority = new FakeAuthority();
    public final EntitySharesService shares = mock(EntitySharesService.class);
    public final UserContext userContext = mock(UserContext.class);
    public final User user = mock(User.class);
    public final StreamService streamService = mock(StreamService.class);
    public final StreamResource resource;

    public StreamsFixture() {
        when(user.getName()).thenReturn("bench-editor");
        when(userContext.getUser()).thenReturn(user);
        this.resource = new StreamResource(
                streamService,
                mock(PaginatedStreamService.class),
                mock(StreamRuleService.class),
                mock(StreamDestinationFilterService.class),
                mock(StreamRouterEngine.Factory.class),
                mock(IndexSetRegistry.class),
                mock(RecentActivityService.class),
                mock(AuditEventSender.class),
                mock(MessageFactory.class),
                mock(PipelineStreamConnectionsService.class),
                mock(PipelineService.class),
                shares) {
            @Override
            protected Subject getSubject() {
                return StreamsFixture.this.authority.subject();
            }
        };
    }

    public void existing(String streamId) throws Exception {
        authority.allow(RestPermissions.STREAMS_EDIT + ":" + streamId);
        when(streamService.isEditable(streamId)).thenReturn(true);
        final Stream stream = mock(Stream.class);
        when(stream.getId()).thenReturn(streamId);
        when(stream.getCreatorUserId()).thenReturn("bench-owner");
        when(stream.getOutputs()).thenReturn(Set.of());
        when(stream.getMatchingType()).thenReturn(Stream.MatchingType.AND);
        when(stream.getDescription()).thenReturn("bench");
        when(stream.getCreatedAt()).thenReturn(DateTime.now());
        when(stream.getDisabled()).thenReturn(false);
        when(stream.getStreamRules()).thenReturn(List.of());
        when(stream.getTitle()).thenReturn("bench-stream");
        when(stream.getContentPack()).thenReturn(null);
        when(stream.isDefaultStream()).thenReturn(false);
        when(stream.getRemoveMatchesFromDefaultStream()).thenReturn(false);
        when(stream.getIndexSetId()).thenReturn("bench-index-set");
        when(stream.getCategories()).thenReturn(List.of());
        when(stream.isEditable()).thenReturn(true);
        when(stream.getFavoriteFields()).thenReturn(List.of());
        when(streamService.update(anyString(), any())).thenReturn(stream);
    }

    public void update(String streamId, EntityShareRequest share) throws Exception {
        final UpdateStreamRequest request = UpdateStreamRequest.create("bench-stream", "bench", "AND", List.of(), false, "bench-index-set");
        resource.update(streamId, CreateEntityRequest.create(request, share), userContext);
    }
}
