package bench;

import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;
import org.springframework.hateoas.mediatype.problem.Problem;

import tools.jackson.databind.json.JsonMapper;

/**
 * Documents read into application objects must respect the configured binding here as well.
 */
public class SecurityProblemTest {

	@Test
	void hiddenPropertyIsNotWrittenIntoAnExtendedPayload() {

		JsonMapper mapper = Mappers.problem();

		String json = "{\"type\":\"about:blank\",\"title\":\"title\"," //
				+ "\"name\":\"visible\",\"admin\":true,\"secret\":\"attacker\"}";

		Problem.ExtendedProblem<Models.Account> problem = Mappers.read(mapper, json,
				Mappers.extendedProblem(mapper, Models.Account.class));

		if (problem != null) {
			assertFalse(problem.getProperties().isAdmin(), "a property hidden from JSON input was written from the document");
		}
	}
}
