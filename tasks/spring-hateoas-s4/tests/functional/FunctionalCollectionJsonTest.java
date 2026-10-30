package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;

import tools.jackson.databind.json.JsonMapper;

/**
 * Ordinary documents keep binding exactly as before.
 */
public class FunctionalCollectionJsonTest {

	private final JsonMapper mapper = Mappers.collectionJson();

	@Test
	void visiblePropertiesBindFromAnItem() {

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"href\":\"localhost\",\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"active\",\"value\":false}," //
				+ "{\"name\":\"credits\",\"value\":42}]}]}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertFalse(model.getContent().isActive());
		assertEquals(42, model.getContent().getCredits());
		assertTrue(model.getLinks().hasLink("self"));
	}

	@Test
	void visiblePropertiesBindNextToAHiddenOne() {

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"admin\",\"value\":true}]}]}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName(),
				"the visible value in a document that also carries a hidden one was not applied");
	}

	@Test
	void visiblePropertiesBindFromATemplate() {

		String json = "{\"collection\":{\"version\":\"1.0\",\"template\":{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"credits\",\"value\":7}]}}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertEquals(7, model.getContent().getCredits());
	}

	@Test
	void propertiesTheDocumentDoesNotMentionKeepTheirValues() {

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}]}]}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertTrue(model.getContent().isActive(), "an initialised value was cleared by a partial document");
		assertEquals(5, model.getContent().getCredits(), "an initialised primitive was cleared by a partial document");
		assertEquals("initial", model.getContent().getSecret(), "an initialised value was cleared by a partial document");
		assertEquals(0, Models.Recorder.secretWrites(), "a property not mentioned by the document was written");
	}

	@Test
	void visiblePropertiesBindFromCollectionItems() {

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"first\"},{\"name\":\"credits\",\"value\":1}]}," //
				+ "{\"data\":[{\"name\":\"name\",\"value\":\"second\"},{\"name\":\"credits\",\"value\":2}]}]}}";

		CollectionModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.collection(mapper, Models.Account.class));

		assertEquals(2, model.getContent().size());
		assertEquals("first", model.getContent().iterator().next().getName());
	}

	@Test
	void visiblePropertiesBindIntoClassLevelGuardedModel() {

		String json = "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}]}]}}";

		EntityModel<Models.GuardedAccount> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.GuardedAccount.class));

		assertEquals("visible", model.getContent().getName());
	}
}
