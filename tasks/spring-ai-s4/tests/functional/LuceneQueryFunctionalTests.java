/*
 * Hidden functional suite. Legitimate metadata filters must keep producing exactly the
 * query strings they produce today, including punctuation-heavy identifiers, values with
 * spaces and colons, scalar types and lists that mix ordinary values with unusual ones.
 */
package org.springframework.ai.vectorstore.htests.functional;

import java.util.Date;
import java.util.List;

import org.junit.jupiter.api.Test;

import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.ai.vectorstore.filter.Filter.ExpressionType;
import org.springframework.ai.vectorstore.filter.FilterExpressionConverter;
import org.springframework.ai.vectorstore.filter.FilterExpressionTextParser;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LuceneQueryFunctionalTests {

	private final FilterExpressionConverter elasticsearch = newConverter(
			"org.springframework.ai.vectorstore.elasticsearch.ElasticsearchAiSearchFilterExpressionConverter");

	private final FilterExpressionConverter openSearch = newConverter(
			"org.springframework.ai.vectorstore.opensearch.OpenSearchAiSearchFilterExpressionConverter");

	private final FilterExpressionConverter gemfire = newConverter(
			"org.springframework.ai.vectorstore.gemfire.GemFireAiSearchFilterExpressionConverter");

	// ---- Elasticsearch ------------------------------------------------------------

	@Test
	void elasticsearchComparisonsKeepTheirShape() {
		assertEquals("metadata.country:\"BG\"",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("country"),
						new Filter.Value("BG"))));
		assertEquals("metadata.year:>=2020",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.GTE, new Filter.Key("year"),
						new Filter.Value(2020))));
		assertEquals("metadata.genre:(\"comedy\" OR \"drama\")",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.IN, new Filter.Key("genre"),
						new Filter.Value(List.of("comedy", "drama")))));
		assertEquals("(metadata.year:>=2020 OR metadata.country:\"BG\") AND NOT metadata.city:(\"Sofia\" OR \"Plovdiv\")",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.AND,
						new Filter.Group(new Filter.Expression(ExpressionType.OR,
								new Filter.Expression(ExpressionType.GTE, new Filter.Key("year"),
										new Filter.Value(2020)),
								new Filter.Expression(ExpressionType.EQ, new Filter.Key("country"),
										new Filter.Value("BG")))),
						new Filter.Expression(ExpressionType.NIN, new Filter.Key("city"),
								new Filter.Value(List.of("Sofia", "Plovdiv"))))));
	}

	@Test
	void elasticsearchScalarValuesKeepTheirShape() {
		assertEquals("metadata.temperature:>=-15.6",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.GTE,
						new Filter.Key("temperature"), new Filter.Value(-15.6))));
		assertEquals("metadata.isOpen:true",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("isOpen"),
						new Filter.Value(true))));
		assertEquals("metadata.activationDate:2024-01-07T14:29:12Z",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ,
						new Filter.Key("activationDate"), new Filter.Value(new Date(1704637752148L)))));
		assertEquals("metadata.description:null",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ,
						new Filter.Key("description"), new Filter.Value(null))));
	}

	@Test
	void elasticsearchPunctuationInIdentifiersAndValuesKeepsWorking() {
		assertEquals("metadata.country\\ 1\\ 2\\ 3:\"BG\"",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ,
						new Filter.Key("country 1 2 3"), new Filter.Value("BG"))));
		assertEquals("metadata.a\\:b:\"v\"",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("a:b"),
						new Filter.Value("v"))));
		assertEquals("metadata.entity.profile.name:\"EntityA\"",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ,
						new Filter.Key("entity.profile.name"), new Filter.Value("EntityA"))));
		assertEquals("metadata.tags\\[0\\]:\"important\"",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("tags[0]"),
						new Filter.Value("important"))));
		assertEquals("metadata.tag:\"a\\ b\\:c\"",
				convert(this.elasticsearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("tag"),
						new Filter.Value("a b:c"))));
	}

	@Test
	void elasticsearchExistenceQueryKeepsItsShape() {
		assertEquals("-metadata.year:*", convert(this.elasticsearch,
				new Filter.Expression(ExpressionType.ISNULL, new Filter.Key("year"))));
		assertEquals("metadata.year:*", convert(this.elasticsearch,
				new Filter.Expression(ExpressionType.ISNOTNULL, new Filter.Key("year"))));
	}

	// ---- OpenSearch ---------------------------------------------------------------

	@Test
	void openSearchComparisonsKeepTheirShape() {
		assertEquals("metadata.country:BG",
				convert(this.openSearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("country"),
						new Filter.Value("BG"))));
		assertEquals("metadata.genre:(comedy OR documentary OR drama)",
				convert(this.openSearch, new Filter.Expression(ExpressionType.IN, new Filter.Key("genre"),
						new Filter.Value(List.of("comedy", "documentary", "drama")))));
		assertEquals("metadata.year:>=2020 OR metadata.country:BG AND metadata.city: NOT Sofia",
				convert(this.openSearch, new Filter.Expression(ExpressionType.OR,
						new Filter.Expression(ExpressionType.GTE, new Filter.Key("year"), new Filter.Value(2020)),
						new Filter.Expression(ExpressionType.AND,
								new Filter.Expression(ExpressionType.EQ, new Filter.Key("country"),
										new Filter.Value("BG")),
								new Filter.Expression(ExpressionType.NE, new Filter.Key("city"),
										new Filter.Value("Sofia"))))));
	}

	@Test
	void openSearchPunctuationInIdentifiersAndValuesKeepsWorking() {
		assertEquals("metadata.country\\ 1\\ 2\\ 3:BG",
				convert(this.openSearch, new Filter.Expression(ExpressionType.EQ,
						new Filter.Key("country 1 2 3"), new Filter.Value("BG"))));
		assertEquals("metadata.key\\:name:v",
				convert(this.openSearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("key:name"),
						new Filter.Value("v"))));
		assertEquals("metadata.entity.profile.name:EntityA",
				convert(this.openSearch, new Filter.Expression(ExpressionType.EQ,
						new Filter.Key("entity.profile.name"), new Filter.Value("EntityA"))));
		assertEquals("metadata.tag:a\\ b\\:c",
				convert(this.openSearch, new Filter.Expression(ExpressionType.EQ, new Filter.Key("tag"),
						new Filter.Value("a b:c"))));
	}

	// ---- GemFire ------------------------------------------------------------------

	@Test
	void gemfireComparisonsKeepTheirShape() {
		assertEquals("country:BG",
				convert(this.gemfire, new Filter.Expression(ExpressionType.EQ, new Filter.Key("country"),
						new Filter.Value("BG"))));
		assertEquals("year:[2020 TO *]",
				convert(this.gemfire, new Filter.Expression(ExpressionType.GTE, new Filter.Key("year"),
						new Filter.Value(2020))));
		assertEquals("country:(BG OR NL OR US)",
				convert(this.gemfire, new Filter.Expression(ExpressionType.IN, new Filter.Key("country"),
						new Filter.Value(List.of("BG", "NL", "US")))));
	}

	@Test
	void gemfirePunctuationInIdentifiersAndValuesKeepsWorking() {
		assertEquals("country\\ 1\\ 2\\ 3:BG",
				convert(this.gemfire, new Filter.Expression(ExpressionType.EQ, new Filter.Key("country 1 2 3"),
						new Filter.Value("BG"))));
		assertEquals("key\\:name:v",
				convert(this.gemfire, new Filter.Expression(ExpressionType.EQ, new Filter.Key("key:name"),
						new Filter.Value("v"))));
		assertEquals("tag:a\\ b\\:c",
				convert(this.gemfire, new Filter.Expression(ExpressionType.EQ, new Filter.Key("tag"),
						new Filter.Value("a b:c"))));
	}

	// ---- Coupled behaviour --------------------------------------------------------

	@Test
	void ordinaryValueStaysLiteralBesideAnUnusualValue() {
		String unusual = "drama\tOR\ttenant.admin:secret";
		for (FilterExpressionConverter converter : List.of(this.elasticsearch, this.openSearch, this.gemfire)) {
			String produced = convert(converter, new Filter.Expression(ExpressionType.IN, new Filter.Key("tag"),
					new Filter.Value(List.of("accepted", unusual))));
			assertTrue(produced.contains("accepted"),
					"an ordinary value next to an unusual one must keep binding: " + produced);
			assertTrue(produced.contains("(") && produced.contains(")"),
					"the value list must keep its shape: " + produced);
		}
	}

	@Test
	void textFilterWithOrdinaryIdentifiersKeepsWorking() {
		Filter.Expression expression = new FilterExpressionTextParser()
			.parse("WHERE region == 'public' && year >= 2020");
		assertEquals("metadata.region:\"public\" AND metadata.year:>=2020",
				convert(this.elasticsearch, expression));
	}

	// ---- helpers ------------------------------------------------------------------

	private static String convert(FilterExpressionConverter converter, Filter.Expression expression) {
		return converter.convertExpression(expression);
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
