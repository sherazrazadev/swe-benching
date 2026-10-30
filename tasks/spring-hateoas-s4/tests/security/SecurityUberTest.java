package bench;

import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.PagedModel;

import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

/**
 * The same rule applies to every supported document format, including this one.
 */
public class SecurityUberTest {

	private JsonMapper mapper;

	@BeforeEach
	void setUp() {
		mapper = Mappers.uber();
	}

	private static String entity(String data) {
		return "{\"uber\":{\"version\":\"1.0\",\"data\":[" //
				+ "{\"rel\":[\"self\"],\"url\":\"/accounts/1\"}," //
				+ "{\"name\":\"account\",\"data\":[" + data + "]}]}}";
	}

	private static String resources(String data) {
		return "{\"uber\":{\"version\":\"1.0\",\"data\":[" //
				+ "{\"data\":[{\"name\":\"account\",\"data\":[" + data + "]}]}]}}";
	}

	@Test
	void hiddenPropertyIsNotWrittenIntoAnEntity() {

		String json = entity("{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"admin\",\"value\":true}");

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		if (model != null) {
			assertFalse(model.getContent().isAdmin(), "a property hidden from JSON input was written from the document");
		}
	}

	@Test
	void hiddenPropertyIsNotWrittenIntoCollectionItems() {

		String json = resources("{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"admin\",\"value\":true}");

		CollectionModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.collection(mapper, Models.Account.class));

		if (model != null) {
			for (Models.Account account : model.getContent()) {
				assertFalse(account.isAdmin(), "a property hidden from JSON input was written from the document");
			}
		}
	}

	@Test
	void hiddenPropertyIsNotWrittenIntoPagedItems() {

		String json = "{\"uber\":{\"version\":\"1.0\",\"data\":[" //
				+ "{\"data\":[{\"name\":\"account\",\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"admin\",\"value\":true}]}]}," //
				+ "{\"name\":\"page\",\"data\":[" //
				+ "{\"name\":\"number\",\"value\":0}," //
				+ "{\"name\":\"size\",\"value\":1}," //
				+ "{\"name\":\"totalElements\",\"value\":1}," //
				+ "{\"name\":\"totalPages\",\"value\":1}]}]}}";

		PagedModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.paged(mapper, Models.Account.class));

		if (model != null) {
			for (Models.Account account : model.getContent()) {
				assertFalse(account.isAdmin(), "a property hidden from JSON input was written from the document");
			}
		}
	}
}
