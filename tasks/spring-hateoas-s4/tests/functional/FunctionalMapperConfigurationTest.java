package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.mediatype.collectionjson.CollectionJsonJacksonModule;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Mapper-level configuration must not disturb the properties it leaves exposed.
 */
public class FunctionalMapperConfigurationTest {

	@Test
	void visiblePropertiesKeepBindingWithAMapperMixIn() {

		JsonMapper mapper = JsonMapper.builder()
				.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
				.addModule(new CollectionJsonJacksonModule())
				.addMixIn(Models.MixinAccount.class, Models.HideFlagMixin.class)
				.build();

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}]}]}}";

		EntityModel<Models.MixinAccount> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.MixinAccount.class));

		assertEquals("visible", model.getContent().getName());
		assertTrue(model.getContent().isFlag(), "a mapper-hidden property that the document omits was changed");
	}
}
