# Metadata filters can add clauses to the generated query string

## The system

This repository is Spring AI, a Java library for AI applications. It ships integrations for
several vector databases, including Elasticsearch, OpenSearch and GemFire, that take an
application's metadata filter and render it into that database's query-string filter syntax.
Applications use those integrations to search documents by metadata and to delete the documents
that match a metadata filter.

## Observed impact

An application builds a metadata filter whose field name comes from data it does not fully
control. When that field name contains a tab character, the generated query string no longer
expresses the one condition the filter describes: the tab ends the field term, and the rest of
the field name is read as query operators and a second field term. A harmless reproduction:
convert a filter that compares a field whose name is `region`, a tab, `OR`, a tab and `tenant`
with an ordinary value; the result contains two field terms instead of one.

## What must hold

For every integration that renders a metadata filter into this query syntax, no part of a field
name or value supplied by the caller may be interpreted as query structure. Whatever the caller
supplies must stay a single literal field name or a single literal value: it must never end the
term, act as an operator or separator, or introduce another condition. This holds for every
position in a filter that comes from the caller, and for every way a filter can be supplied.

## Contracts

- **Refusal.** A filter that cannot be rendered safely may be rejected with an error instead of
  producing a query string; a rejected filter must not produce a partial or altered query.
- **Preservation.** Everything that works today keeps working exactly as today. Ordinary field
  names and values stay literal even when they contain spaces, dots, colons, brackets or other
  punctuation. Numbers, booleans, dates, nulls, empty and single-item lists, mixed lists, groups
  and negations keep producing the same query strings, and dotted field names keep addressing the
  same field.
- **Neighbours.** A legitimate value next to an unusual one keeps binding: a list that also
  contains a caller-supplied value with a tab must still bind the ordinary values in it.
- **Surfaces.** The affected public surface is the library's filter-expression conversion API
  that each of these integrations uses.

The example above is one example; it is not the full set of affected inputs or setups.

## Constraints

- Fix the problem and its close variants, not just the example.
- Keep every legitimate use working.
- Do not look up the upstream fix for this issue.
- Do not special-case the example inputs.
