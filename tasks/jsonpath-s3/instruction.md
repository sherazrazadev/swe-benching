jsonpath-plus is a JavaScript library for querying JSON documents with JSONPath expressions. A service uses it to run a query string supplied by a user against data the service holds. Besides selecting values, the library evaluates the small JavaScript expressions that can appear in filters and in dynamic property selectors.

## Observed impact

A service asks the library to evaluate a query string supplied by a user against data it holds, with the default settings. A user supplies a filter expression that reaches the host process and runs code there: it reads a value from the process and returns it as part of the query result, and it can also run commands in the service process. Nothing refuses the query.

## Required behaviour

When the package evaluates an expression in its default, non-native setting, no expression that a caller supplies may make the host runtime execute JavaScript code carried in the expression, or obtain any capability of the host process. This invariant holds whatever the expression looks like, however it is supplied, and on every safe evaluation surface the package offers — including an expression that was stored earlier and evaluated later.

An expression that is refused produces an ordinary evaluation error, or no match, and nothing in the expression runs; no file, process, network or other side effect happens.

Legitimate use keeps working exactly as today:

- filters and dynamic property selectors that compare, combine and calculate values from the query's data keep returning the same results;
- the data and helper values the caller supplies stay usable, including calls to helper functions and to methods on values;
- the operators and literals that such expressions use, such as `typeof`, `null` and `undefined`, keep working;
- a caller that explicitly asks for the library's native evaluation, disables evaluation, or supplies its own evaluation hook keeps getting that behaviour;
- every build of the package keeps its legitimate use working, and a query that was stored earlier still works when it is evaluated later.

That case is one example, not the full set.

## Constraints

- Fix the problem and its close variants, not only the example above.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example (its text, its shape or the data it runs against).
- There is no network access.
