package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;

import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ordinary documents keep binding exactly as before.
 */
public class FunctionalHalFormsTest {

	private final JsonMapper mapper = Mappers.halForms();

	@Test
	void visiblePropertiesBindFromAPlainRepresentation() {

		String json = "{\"name\":\"visible\",\"active\":false,\"credits\":42," //
				+ "\"_links\":{\"self\":{\"href\":\"localhost\"}}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertFalse(model.getContent().isActive());
		assertEquals(42, model.getContent().getCredits());
		assertTrue(model.getLinks().hasLink("self"));
	}

	@Test
	void visiblePropertiesBindFromATemplate() {

		String json = "{\"_links\":{\"self\":{\"href\":\"localhost\"}}," //
				+ "\"_templates\":{\"default\":{\"properties\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"credits\",\"value\":9}]}}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertEquals(9, model.getContent().getCredits());
		assertTrue(model.getLinks().hasLink("self"));
	}

	@Test
	void propertiesTheDocumentDoesNotMentionKeepTheirValues() {

		String json = "{\"_templates\":{\"default\":{\"properties\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}]}}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals("visible", model.getContent().getName());
		assertTrue(model.getContent().isActive(), "an initialised value was cleared by a partial document");
		assertEquals(5, model.getContent().getCredits(), "an initialised primitive was cleared by a partial document");
		assertEquals("initial", model.getContent().getSecret(), "an initialised value was cleared by a partial document");
	}

	@Test
	void visiblePropertiesBindIntoEmbeddedResources() {

		JsonMapper mapper = Mappers.halForms();
		JavaType type = mapper.getTypeFactory().constructParametricType(CollectionModel.class,
				mapper.getTypeFactory().constructParametricType(EntityModel.class, Models.Account.class));

		String json = "{\"_embedded\":{\"accounts\":[{\"name\":\"visible\",\"credits\":3}]}}";

		CollectionModel<?> model = Mappers.read(mapper, json, type);

		EntityModel<?> first = (EntityModel<?>) model.getContent().iterator().next();
		Models.Account account = (Models.Account) first.getContent();

		assertEquals("visible", account.getName());
		assertEquals(3, account.getCredits());
	}
}
