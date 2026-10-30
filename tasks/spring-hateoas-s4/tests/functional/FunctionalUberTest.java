package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;

import tools.jackson.databind.json.JsonMapper;

/**
 * Ordinary documents keep binding exactly as before.
 */
public class FunctionalUberTest {

	private final JsonMapper mapper = Mappers.uber();

	@Test
	void visiblePropertiesBindFromAnEntity() {

		String json = "{\"uber\":{\"version\":\"1.0\",\"data\":[" //
				+ "{\"rel\":[\"self\"],\"url\":\"/accounts/1\"}," //
				+ "{\"name\":\"account\",\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"credits\",\"value\":42}]}]}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertEquals(42, model.getContent().getCredits());
		assertTrue(model.getLinks().hasLink("self"));
	}

	@Test
	void visiblePropertiesBindFromCollectionItems() {

		String json = "{\"uber\":{\"version\":\"1.0\",\"data\":[" //
				+ "{\"data\":[{\"name\":\"account\",\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"first\"},{\"name\":\"credits\",\"value\":1}]}]}," //
				+ "{\"data\":[{\"name\":\"account\",\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"second\"},{\"name\":\"credits\",\"value\":2}]}]}]}}";

		CollectionModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.collection(mapper, Models.Account.class));

		assertEquals(2, model.getContent().size());
		assertEquals("first", model.getContent().iterator().next().getName());
		assertEquals(2, model.getContent().iterator().next().getCredits() + 1);
	}

	@Test
	void propertiesTheDocumentDoesNotMentionKeepTheirValues() {

		String json = "{\"uber\":{\"version\":\"1.0\",\"data\":[" //
				+ "{\"name\":\"account\",\"data\":[{\"name\":\"name\",\"value\":\"visible\"}]}]}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertTrue(model.getContent().isActive(), "an initialised value was cleared by a partial document");
		assertEquals(5, model.getContent().getCredits(), "an initialised primitive was cleared by a partial document");
		assertEquals("initial", model.getContent().getSecret(), "an initialised value was cleared by a partial document");
	}
}
