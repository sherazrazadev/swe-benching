package bench;

import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;

import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

/**
 * The same rule applies to every supported document format, including this one.
 */
public class SecurityHalFormsTest {

	private final JsonMapper mapper = Mappers.halForms();

	private static String properties(String name, String value) {
		return "{\"name\":\"" + name + "\",\"value\":" + value + "}";
	}

	@Test
	void hiddenPropertyIsNotWrittenFromTheDefaultTemplate() {

		String json = "{\"_links\":{\"self\":{\"href\":\"localhost\"}}," //
				+ "\"_templates\":{\"default\":{\"method\":\"POST\",\"properties\":[" //
				+ properties("name", "\"visible\"") + "," //
				+ properties("admin", "true") + "]}}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		if (model != null) {
			assertFalse(model.getContent().isAdmin(), "a property hidden from JSON input was written from the document");
		}
	}

	@Test
	void hiddenPropertyIsNotWrittenFromANamedTemplate() {

		String json = "{\"_templates\":{\"postAccount\":{\"properties\":[" //
				+ properties("name", "\"visible\"") + "," //
				+ properties("admin", "true") + "]}}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		if (model != null) {
			assertFalse(model.getContent().isAdmin(), "a property hidden from JSON input was written from the document");
		}
	}

	@Test
	void hiddenPropertyIsNotWrittenIntoAnEmbeddedResource() {

		JsonMapper mapper = Mappers.halForms();
		JavaType type = mapper.getTypeFactory().constructParametricType(CollectionModel.class,
				mapper.getTypeFactory().constructParametricType(EntityModel.class, Models.Account.class));

		String json = "{\"_embedded\":{\"accounts\":[{" //
				+ "\"name\":\"visible\"," //
				+ "\"_templates\":{\"default\":{\"properties\":[" + properties("admin", "true") + "]}}}]}}";

		CollectionModel<?> model = Mappers.read(mapper, json, type);

		if (model != null) {
			for (Object item : model.getContent()) {
				Models.Account account = (Models.Account) ((EntityModel<?>) item).getContent();
				assertFalse(account.isAdmin(), "a property hidden from JSON input was written from the document");
			}
		}
	}
}
