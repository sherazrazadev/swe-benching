package bench;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.shiro.subject.Subject;
import org.graylog.events.context.EventDefinitionContextService;
import org.graylog.events.notifications.DBNotificationService;
import org.graylog.events.notifications.EventNotificationConfig;
import org.graylog.events.notifications.EventNotificationSettings;
import org.graylog.events.notifications.NotificationDto;
import org.graylog.events.notifications.NotificationResourceHandler;
import org.graylog.events.processor.DBEventDefinitionService;
import org.graylog.events.processor.DefaultEventResolver;
import org.graylog.events.processor.EventDefinitionConfiguration;
import org.graylog.events.processor.EventDefinitionDto;
import org.graylog.events.processor.EventDefinitionHandler;
import org.graylog.events.processor.EventProcessorConfig;
import org.graylog.events.contentpack.entities.EventProcessorConfigEntity;
import org.graylog.events.contentpack.entities.EventNotificationConfigEntity;
import org.graylog.events.processor.EventProcessorEngine;
import org.graylog.events.rest.EventDefinitionsResource;
import org.graylog.events.rest.EventNotificationsResource;
import org.graylog.plugins.views.startpage.recentActivities.RecentActivityService;
import org.graylog.security.UserContext;
import org.graylog.security.shares.CreateEntityRequest;
import org.graylog.security.shares.EntityShareRequest;
import org.graylog.security.shares.EntitySharesService;
import org.graylog2.audit.AuditEventSender;
import org.graylog2.configuration.EmailConfiguration;
import org.graylog2.contentpacks.EntityDescriptorIds;
import org.graylog2.plugin.alarms.callbacks.AlarmCallback;
import org.graylog2.plugin.database.users.User;
import org.graylog2.plugin.rest.ValidationResult;
import org.graylog2.shared.security.RestPermissions;

import com.google.common.collect.ImmutableList;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Builds the event definition and event notification update resources over stubbed collaborators. */
public final class EventsFixture {
    public final FakeAuthority authority = new FakeAuthority();
    public final EntitySharesService shares = mock(EntitySharesService.class);
    public final UserContext userContext = mock(UserContext.class);
    public final User user = mock(User.class);

    public EventsFixture() {
        when(user.getName()).thenReturn("bench-editor");
        when(userContext.getUser()).thenReturn(user);
    }

    public EventDefinitionDto eventDefinition(String id) {
        return EventDefinitionDto.builder()
                .id(id)
                .title("bench-definition")
                .description("bench")
                .priority(1)
                .config(new StubProcessorConfig())
                .alert(false)
                .keySpec(ImmutableList.of())
                .notificationSettings(EventNotificationSettings.withGracePeriod(0L))
                .build();
    }

    public DefinitionResource definition(String id) {
        final DBEventDefinitionService db = mock(DBEventDefinitionService.class);
        final EventDefinitionHandler handler = mock(EventDefinitionHandler.class);
        final EventDefinitionDto dto = eventDefinition(id);
        when(db.get(id)).thenReturn(Optional.of(dto));
        when(handler.update(any(), anyBoolean())).thenReturn(dto);
        final EventDefinitionsResource resource = new EventDefinitionsResource(
                db,
                handler,
                mock(EventDefinitionContextService.class),
                mock(EventProcessorEngine.class),
                mock(RecentActivityService.class),
                mock(AuditEventSender.class),
                mock(ObjectMapper.class),
                new DefaultEventResolver(),
                new EventDefinitionConfiguration(),
                shares) {
            @Override
            protected Subject getSubject() {
                return EventsFixture.this.authority.subject();
            }
        };
        return new DefinitionResource(resource, dto, id);
    }

    public NotificationResource notification(String id) {
        final DBNotificationService db = mock(DBNotificationService.class);
        final NotificationResourceHandler handler = mock(NotificationResourceHandler.class);
        final NotificationDto dto = NotificationDto.builder()
                .id(id)
                .title("bench-notification")
                .description("bench")
                .config(new StubNotificationConfig())
                .build();
        when(db.get(id)).thenReturn(Optional.of(dto));
        when(handler.update(any())).thenReturn(dto);
        final EventNotificationsResource resource = new EventNotificationsResource(
                db,
                Set.<AlarmCallback>of(),
                handler,
                mock(EmailConfiguration.class),
                mock(RecentActivityService.class),
                shares) {
            @Override
            protected Subject getSubject() {
                return EventsFixture.this.authority.subject();
            }
        };
        return new NotificationResource(resource, dto, id);
    }

    public final class DefinitionResource {
        public final EventDefinitionsResource resource;
        public final EventDefinitionDto dto;
        public final String id;

        DefinitionResource(EventDefinitionsResource resource, EventDefinitionDto dto, String id) {
            this.resource = resource;
            this.dto = dto;
            this.id = id;
            authority.allow(RestPermissions.EVENT_DEFINITIONS_EDIT + ":" + id);
        }

        public void update(EntityShareRequest share) {
            resource.update(id, true, CreateEntityRequest.create(dto, share), userContext);
        }
    }

    public final class NotificationResource {
        public final EventNotificationsResource resource;
        public final NotificationDto dto;
        public final String id;

        NotificationResource(EventNotificationsResource resource, NotificationDto dto, String id) {
            this.resource = resource;
            this.dto = dto;
            this.id = id;
            authority.allow(RestPermissions.EVENT_NOTIFICATIONS_EDIT + ":" + id);
        }

        public void update(EntityShareRequest share) {
            resource.update(id, CreateEntityRequest.create(dto, share), userContext);
        }
    }

    static final class StubProcessorConfig implements EventProcessorConfig {
        @Override
        public String type() {
            return "bench";
        }

        @Override
        public ValidationResult validate(UserContext userContext) {
            return new ValidationResult();
        }

        @Override
        public EventProcessorConfigEntity toContentPackEntity(EntityDescriptorIds entityDescriptorIds) {
            return null;
        }
    }

    static final class StubNotificationConfig implements EventNotificationConfig {
        @Override
        public String type() {
            return "bench";
        }

        @Override
        public org.graylog.scheduler.JobTriggerData toJobTriggerData(
                org.graylog.events.event.EventDto dto) {
            return null;
        }

        @Override
        public ValidationResult validate() {
            return new ValidationResult();
        }

        @Override
        public EventNotificationConfigEntity toContentPackEntity(
                EntityDescriptorIds entityDescriptorIds) {
            return null;
        }
    }
}
