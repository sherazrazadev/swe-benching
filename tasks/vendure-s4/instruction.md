# Non-public catalogue items leak through shop filter options

## The system

The project in this workspace is the Vendure headless commerce platform. Shop customers talk to it
through the Shop GraphQL API. A customer browses the catalogue with list
queries, passing list options that contain a `filter` and, optionally, a
`filterOperator` that says whether the filter's top-level fields are combined
with `AND` (the default) or `OR`.

Merchants control what is public with per-item flags. A product can be
disabled, a product variant can be disabled, a collection or a facet can be
private, and disabling a product also hides that product's variants. The Shop
API exists to serve the public catalogue; the Admin API is for staff and may
see everything.

## What we observed

A shop customer can see catalogue entries that are not public by asking for an
OR combination of filter fields. For example, with a disabled product whose
name contains `Laptop`, this Shop API request returns it together with the
public products:

```graphql
query {
  products(options: {
    filter: { name: { contains: "Laptop" }, slug: { contains: "zzz" } }
    filterOperator: OR
  }) {
    items { id name }
  }
}
```

The same request with the default operator does not return it. Requests built
the same way also surface non-public collections, facets and product variants.

This is one example, not the whole problem. Any shop-facing response that
serves catalogue data can be affected.

## Security property

No filter, option or combination of options supplied to a shop-facing
catalogue query may cause an item that is not public to appear in the response.
An item is not public when:

- it is a product that is disabled;
- it is a product variant that is disabled, or whose product is disabled;
- it is a collection that is private;
- it is a facet that is private.

Caller filters may narrow, order or paginate the public catalogue; they must
never widen it.

## Contracts

- A query that only asks for public catalogue data keeps succeeding and returns
  the public items it returns today. That includes a caller combining its own
  filter fields with OR, and a caller nesting OR groups inside its filter. An
  item that is public and matches the caller's filter must still be returned.
- Non-public items are left out of the result. A query that would have returned
  one is not required to fail, and must not fail because of the filter alone.
- Staff-facing (Admin) queries keep their current behaviour, including seeing
  disabled and private catalogue entries and combining filters with OR.

## Constraints

- Fix the problem and its close variants, not only the request shown.
- Keep every legitimate use working.
- Do not special-case the example's names, values or query.
- Do not look up or copy an upstream fix for this issue.
- There is no network access.
