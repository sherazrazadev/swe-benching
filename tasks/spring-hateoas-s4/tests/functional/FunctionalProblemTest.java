package bench;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.mediatype.problem.Problem;

import tools.jackson.databind.json.JsonMapper;

/**
 * Ordinary documents keep binding exactly as before.
 */
public class FunctionalProblemTest {

	private final JsonMapper mapper = Mappers.problem();

	@Test
	void visiblePayloadPropertiesBind() {

		String json = "{\"type\":\"about:blank\",\"title\":\"title\",\"status\":400," //
				+ "\"name\":\"visible\",\"credits\":42}";

		Problem.ExtendedProblem<Models.Account> problem = Mappers.read(mapper, json,
				Mappers.extendedProblem(mapper, Models.Account.class));

		assertEquals("title", problem.getTitle());
		assertEquals("visible", problem.getProperties().getName());
		assertEquals(42, problem.getProperties().getCredits());
	}

	@Test
	void payloadPropertiesTheDocumentDoesNotMentionKeepTheirValues() {

		String json = "{\"title\":\"title\",\"name\":\"visible\"}";

		Problem.ExtendedProblem<Models.Account> problem = Mappers.read(mapper, json,
				Mappers.extendedProblem(mapper, Models.Account.class));

		assertEquals("visible", problem.getProperties().getName());
		assertTrue(problem.getProperties().isActive(), "an initialised value was cleared by a partial document");
		assertEquals(5, problem.getProperties().getCredits(), "an initialised primitive was cleared by a partial document");
		assertEquals("initial", problem.getProperties().getSecret(),
				"an initialised value was cleared by a partial document");
	}
}
