/*
 * Hidden support helper: decides whether caller-supplied separators reached the
 * generated query string without being neutralised.
 */
package org.springframework.ai.vectorstore.htests;

import java.util.Objects;

public final class InjectionAssert {

	/** Characters that end a token in the query syntax these converters target. */
	private static final char[] SEPARATORS = { '\t', '\n', '\r', '\u3000' };

	private InjectionAssert() {
	}

	/**
	 * The generated query string must keep every separator the caller supplied inert:
	 * each one has to be backslash-escaped, and none may be dropped or duplicated.
	 * A converter may also refuse the whole filter before producing a string.
	 * @param produced the query string the converter produced
	 * @param callerText the field name or value text the caller supplied
	 */
	public static void assertBlocked(String produced, String callerText) {
		Objects.requireNonNull(produced, "the converter returned null");
		for (char separator : SEPARATORS) {
			int supplied = count(callerText, separator);
			if (supplied == 0) {
				continue;
			}
			int seen = 0;
			for (int i = 0; i < produced.length(); i++) {
				if (produced.charAt(i) != separator) {
					continue;
				}
				seen++;
				int backslashes = 0;
				for (int j = i - 1; j >= 0 && produced.charAt(j) == '\\'; j--) {
					backslashes++;
				}
				if (backslashes % 2 == 0) {
					throw new AssertionError("the generated query string contains an unescaped "
							+ name(separator) + " from caller data at offset " + i + ": " + visible(produced));
				}
			}
			if (seen != supplied) {
				throw new AssertionError("the generated query string changed the number of " + name(separator)
						+ " characters supplied by the caller (" + supplied + " supplied, " + seen + " emitted): "
						+ visible(produced));
			}
		}
	}

	private static int count(String text, char character) {
		int n = 0;
		for (int i = 0; i < text.length(); i++) {
			if (text.charAt(i) == character) {
				n++;
			}
		}
		return n;
	}

	private static String name(char character) {
		return switch (character) {
			case '\t' -> "tab";
			case '\n' -> "newline";
			case '\r' -> "carriage return";
			case '\u3000' -> "ideographic space";
			default -> "'" + character + "'";
		};
	}

	private static String visible(String text) {
		return text.replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r").replace("\u3000", "\\u3000");
	}

}
