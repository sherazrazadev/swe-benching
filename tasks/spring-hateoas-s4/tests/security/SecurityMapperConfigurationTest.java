package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.mediatype.collectionjson.CollectionJsonJacksonModule;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * The mapper's own configuration decides which properties may be written, not only annotations on the model.
 */
public class SecurityMapperConfigurationTest {

	@Test
	void propertyHiddenByMapperConfigurationIsNotWritten() {

		JsonMapper mapper = JsonMapper.builder()
				.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
				.addModule(new CollectionJsonJacksonModule())
				.addMixIn(Models.MixinAccount.class, Models.HideFlagMixin.class)
				.build();

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"flag\",\"value\":false}]}]}}";

		EntityModel<Models.MixinAccount> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.MixinAccount.class));

		if (model != null) {
			assertTrue(model.getContent().isFlag(),
					"a property hidden by the mapper's configuration was written from the document");
		}
	}

	@Test
	void propertyIsNotWrittenUnderANameTheConfigurationDoesNotExpose() {

		JsonMapper mapper = Mappers.collectionJson();

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"token\",\"value\":\"attacker\"}]}]}}";

		EntityModel<Models.RenamedAccount> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.RenamedAccount.class));

		if (model != null) {
			assertEquals("initial-token", model.getContent().getToken(),
					"a property was written under a name the configuration does not expose");
		}
	}
}
