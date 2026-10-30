package bench;

import org.springframework.hateoas.CollectionModel;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.PagedModel;
import org.springframework.hateoas.mediatype.collectionjson.CollectionJsonJacksonModule;
import org.springframework.hateoas.mediatype.hal.forms.HalFormsJacksonModule;
import org.springframework.hateoas.mediatype.problem.Problem;
import org.springframework.hateoas.mediatype.problem.ProblemJacksonModule;
import org.springframework.hateoas.mediatype.uber.UberJacksonModule;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.json.JsonMapper;

/**
 * Builds the JSON mappers the library's users configure, one per supported hypermedia format.
 */
public final class Mappers {

	private Mappers() {}

	public static JsonMapper collectionJson() {
		return mapper(new CollectionJsonJacksonModule());
	}

	public static JsonMapper uber() {
		return mapper(new UberJacksonModule());
	}

	public static JsonMapper halForms() {
		return mapper(new HalFormsJacksonModule());
	}

	public static JsonMapper problem() {
		return mapper(new ProblemJacksonModule());
	}

	public static JsonMapper mapper(JacksonModule... modules) {

		JsonMapper.Builder builder = JsonMapper.builder()
				.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

		for (JacksonModule module : modules) {
			builder = builder.addModule(module);
		}

		return builder.build();
	}

	public static JavaType entity(JsonMapper mapper, Class<?> content) {
		return mapper.getTypeFactory().constructParametricType(EntityModel.class, content);
	}

	public static JavaType collection(JsonMapper mapper, Class<?> content) {
		return mapper.getTypeFactory().constructParametricType(CollectionModel.class, content);
	}

	public static JavaType paged(JsonMapper mapper, Class<?> content) {
		return mapper.getTypeFactory().constructParametricType(PagedModel.class, content);
	}

	public static JavaType extendedProblem(JsonMapper mapper, Class<?> content) {
		return mapper.getTypeFactory().constructParametricType(Problem.ExtendedProblem.class, content);
	}

	/**
	 * Reads the given document, returning {@literal null} when the document is refused. A refusal without a side effect
	 * is a valid way to keep the protected property untouched.
	 */
	public static <T> T read(JsonMapper mapper, String json, JavaType type) {

		try {
			return mapper.readValue(json, type);
		} catch (Exception e) {
			return null;
		}
	}
}
