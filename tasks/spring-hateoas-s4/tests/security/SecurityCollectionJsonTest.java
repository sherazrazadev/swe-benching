package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.PagedModel;

import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

/**
 * A document in this media format must not write a property the configured binding hides.
 */
public class SecurityCollectionJsonTest {

	private JsonMapper mapper;

	@BeforeEach
	void setUp() {
		mapper = Mappers.collectionJson();
		Models.Recorder.reset();
	}

	private static String item(String data) {
		return "{\"collection\":{\"version\":\"1.0\",\"items\":[{\"href\":\"localhost\",\"data\":[" + data + "]}]}}";
	}

	@Test
	void hiddenGetterIsNotWrittenFromAnItem() {

		String json = item("{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"admin\",\"value\":true}");

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		if (model != null) {
			assertNotNull(model.getContent());
			assertFalse(model.getContent().isAdmin(), "a property hidden from JSON input was written from the document");
		}
	}

	@Test
	void hiddenSetterIsNotInvokedFromAnItem() {

		String json = item("{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"secret\",\"value\":\"attacker\"}");

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals(0, Models.Recorder.secretWrites(), "the writer of a hidden property was invoked");
		if (model != null) {
			assertEquals("initial", model.getContent().getSecret(), "a property hidden from JSON input was written");
		}
	}

	@Test
	void hiddenPropertyIsNotWrittenFromATemplate() {

		String json = "{\"collection\":{\"version\":\"1.0\",\"template\":{\"data\":[" //
				+ "{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"secret\",\"value\":\"attacker\"}]}}}";

		EntityModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.Account.class));

		assertEquals(0, Models.Recorder.secretWrites(), "the writer of a hidden property was invoked");
		if (model != null) {
			assertEquals("initial", model.getContent().getSecret(), "a property hidden from JSON input was written");
		}
	}

	@Test
	void hiddenPropertyIsNotWrittenIntoCollectionItems() {

		String json = item("{\"name\":\"name\",\"value\":\"visible\"}," //
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

		String json = item("{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"admin\",\"value\":true}");

		PagedModel<Models.Account> model = Mappers.read(mapper, json,
				Mappers.paged(mapper, Models.Account.class));

		if (model != null) {
			for (Models.Account account : model.getContent()) {
				assertFalse(account.isAdmin(), "a property hidden from JSON input was written from the document");
			}
		}
	}

	@Test
	void propertyIgnoredAtClassLevelIsNotWritten() {

		String json = item("{\"name\":\"name\",\"value\":\"visible\"}," //
				+ "{\"name\":\"internal\",\"value\":\"attacker\"}");

		EntityModel<Models.GuardedAccount> model = Mappers.read(mapper, json,
				Mappers.entity(mapper, Models.GuardedAccount.class));

		if (model != null) {
			assertEquals("initial-internal", model.getContent().getInternal(),
					"a property hidden from JSON input was written from the document");
		}
	}
}
