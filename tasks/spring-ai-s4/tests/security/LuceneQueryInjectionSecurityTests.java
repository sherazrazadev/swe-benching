/*
 * Hidden security suite. Every case builds a metadata filter whose field name or value
 * comes from the caller and carries a query-syntax separator, converts it through the
 * public filter-conversion API of a vector-store integration, and requires the
 * separator to stay inert (escaped) or the conversion to be refused.
 */
package org.springframework.ai.vectorstore.htests.security;

import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.ai.vectorstore.filter.Filter.ExpressionType;
import org.springframework.ai.vectorstore.filter.FilterExpressionConverter;
import org.springframework.ai.vectorstore.filter.FilterExpressionTextParser;
import org.springframework.ai.vectorstore.htests.InjectionAssert;

class LuceneQueryInjectionSecurityTests {

	private static final String KEY_TAB = "region\tOR\ttenant";

	private static final String KEY_NEWLINE = "region\nOR\rtenant";

	private static final String KEY_IDEOGRAPHIC_SPACE = "region　OR　tenant";

	private static final String COMPOUND_KEY_TAB = "region\tOR\ttenant.leaf";

	private static final String COMPOUND_KEY_NEWLINE = "region\nOR\rtenant.leaf";

	private static final String VALUE_TAB = "drama\tOR\ttenant.admin:secret";

	private static final String VALUE_NEWLINE = "drama\nOR\rtenant.admin:secret";

	private static final String VALUE_IDEOGRAPHIC_SPACE = "drama　OR　tenant.admin:secret";

	private static final String QUOTED_VALUE_TAB = "'drama\tOR\ttenant.admin'";

	private static final String QUOTED_VALUE_NEWLINE = "\"drama\nOR\rtenant.admin\"";

	private final FilterExpressionConverter elasticsearch = newConverter(
			"org.springframework.ai.vectorstore.elasticsearch.ElasticsearchAiSearchFilterExpressionConverter");

	private final FilterExpressionConverter openSearch = newConverter(
			"org.springframework.ai.vectorstore.opensearch.OpenSearchAiSearchFilterExpressionConverter");

	private final FilterExpressionConverter gemfire = newConverter(
			"org.springframework.ai.vectorstore.gemfire.GemFireAiSearchFilterExpressionConverter");

	// ---- Elasticsearch field names ------------------------------------------------

	@Test
	void elasticsearchFieldNameWithTab() {
		blocks(this.elasticsearch, eq(KEY_TAB), KEY_TAB);
	}

	@Test
	void elasticsearchFieldNameWithNewlineAndCarriageReturn() {
		blocks(this.elasticsearch, eq(KEY_NEWLINE), KEY_NEWLINE);
	}

	@Test
	void elasticsearchFieldNameWithIdeographicSpace() {
		blocks(this.elasticsearch, eq(KEY_IDEOGRAPHIC_SPACE), KEY_IDEOGRAPHIC_SPACE);
	}

	@Test
	void elasticsearchExistsFieldNameWithTab() {
		blocks(this.elasticsearch, exists(KEY_TAB, true), KEY_TAB);
	}

	@Test
	void elasticsearchExistsFieldNameWithNewline() {
		blocks(this.elasticsearch, exists(KEY_NEWLINE, false), KEY_NEWLINE);
	}

	// ---- OpenSearch field names --------------------------------------------------

	@Test
	void openSearchFieldNameWithTab() {
		blocks(this.openSearch, eq(KEY_TAB), KEY_TAB);
	}

	@Test
	void openSearchFieldNameWithIdeographicSpace() {
		blocks(this.openSearch, eq(KEY_IDEOGRAPHIC_SPACE), KEY_IDEOGRAPHIC_SPACE);
	}

	@Test
	void openSearchCompoundFieldNameWithTab() {
		blocks(this.openSearch, eq(COMPOUND_KEY_TAB), COMPOUND_KEY_TAB);
	}

	@Test
	void openSearchCompoundFieldNameWithNewline() {
		blocks(this.openSearch, eq(COMPOUND_KEY_NEWLINE), COMPOUND_KEY_NEWLINE);
	}

	// ---- OpenSearch values -------------------------------------------------------

	@Test
	void openSearchValueWithTab() {
		blocks(this.openSearch, value(VALUE_TAB), VALUE_TAB);
	}

	@Test
	void openSearchValueWithNewlineAndCarriageReturn() {
		blocks(this.openSearch, value(VALUE_NEWLINE), VALUE_NEWLINE);
	}

	@Test
	void openSearchValueWithIdeographicSpace() {
		blocks(this.openSearch, value(VALUE_IDEOGRAPHIC_SPACE), VALUE_IDEOGRAPHIC_SPACE);
	}

	@Test
	void openSearchListValueWithTab() {
		Filter.Expression expression = new Filter.Expression(ExpressionType.IN, new Filter.Key("tag"),
				new Filter.Value(List.of("drama", VALUE_TAB)));
		blocks(this.openSearch, expression, VALUE_TAB);
	}

	// ---- GemFire field names and values ------------------------------------------

	@Test
	void gemfireFieldNameWithTab() {
		blocks(this.gemfire, eq(KEY_TAB), KEY_TAB);
	}

	@Test
	void gemfireFieldNameWithIdeographicSpace() {
		blocks(this.gemfire, eq(KEY_IDEOGRAPHIC_SPACE), KEY_IDEOGRAPHIC_SPACE);
	}

	@Test
	void gemfireValueWithTab() {
		blocks(this.gemfire, value(VALUE_TAB), VALUE_TAB);
	}

	@Test
	void gemfireValueWithNewlineAndCarriageReturn() {
		blocks(this.gemfire, value(VALUE_NEWLINE), VALUE_NEWLINE);
	}

	@Test
	void gemfireQuotedValueWithTab() {
		blocks(this.gemfire, value(QUOTED_VALUE_TAB), QUOTED_VALUE_TAB);
	}

	@Test
	void gemfireQuotedValueWithNewline() {
		blocks(this.gemfire, value(QUOTED_VALUE_NEWLINE), QUOTED_VALUE_NEWLINE);
	}

	@Test
	void gemfireListValueWithTab() {
		Filter.Expression expression = new Filter.Expression(ExpressionType.IN, new Filter.Key("tag"),
				new Filter.Value(List.of("drama", VALUE_TAB)));
		blocks(this.gemfire, expression, VALUE_TAB);
	}

	// ---- Filters supplied as text -------------------------------------------------

	@Test
	void elasticsearchTextFilterFieldNameWithTab() {
		Filter.Expression expression = new FilterExpressionTextParser()
			.parse("WHERE \"region\tOR\ttenant\" == 'public'");
		blocks(this.elasticsearch, expression, KEY_TAB);
	}

	@Test
	void openSearchTextFilterFieldNameWithTab() {
		Filter.Expression expression = new FilterExpressionTextParser()
			.parse("WHERE \"region\tOR\ttenant\" == 'public'");
		blocks(this.openSearch, expression, KEY_TAB);
	}

	// ---- helpers ------------------------------------------------------------------

	private static Filter.Expression eq(String fieldName) {
		return new Filter.Expression(ExpressionType.EQ, new Filter.Key(fieldName), new Filter.Value("public"));
	}

	private static Filter.Expression value(String text) {
		return new Filter.Expression(ExpressionType.EQ, new Filter.Key("tag"), new Filter.Value(text));
	}

	private static Filter.Expression exists(String fieldName, boolean isNull) {
		return new Filter.Expression(isNull ? ExpressionType.ISNULL : ExpressionType.ISNOTNULL,
				new Filter.Key(fieldName));
	}

	private static void blocks(FilterExpressionConverter converter, Filter.Expression expression, String callerText) {
		String produced;
		try {
			produced = converter.convertExpression(expression);
		}
		catch (RuntimeException refused) {
			return;
		}
		InjectionAssert.assertBlocked(produced, callerText);
	}

	private static FilterExpressionConverter newConverter(String className) {
		try {
			return (FilterExpressionConverter) Class.forName(className).getDeclaredConstructor().newInstance();
		}
		catch (ReflectiveOperationException ex) {
			throw new IllegalStateException("cannot create " + className, ex);
		}
	}

}
