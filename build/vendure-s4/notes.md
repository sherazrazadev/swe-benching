# vendure-s4 build notes

- Start: 2026-10-29T17:13:57Z
- End: 2026-10-29T18:50:36Z

## Task

Vendure Shop API catalogue queries merge a mandatory public-only guard into the
caller's filter object. `ListQueryBuilder` applies the caller's top-level
`filterOperator` to every top-level key, so `OR` turns the guard into a
disjunction and non-public rows come back (CWE-200). Pinned
`f74cbbb0b9a50b5b0131822835fe7ee9b71b42c9`; published fix
`6daf5cb8571321eb6c6afa1d8e95a390c060be02`.

Security property (stated once, over the protected data): no filter, option or
combination of options supplied to a shop-facing catalogue query may cause an
item that is not public (a disabled product; a disabled variant or a variant of
a disabled product; a private collection; a private facet) to appear in the
response. Caller filters may narrow, order or paginate the public catalogue;
they must never widen it.

## Levers (one line each)

1. T1 (published landing, where-type): `filterOperator: OR` on the shop
   `products` / `collections` / `facets` list queries turns the merged guard
   into a disjunction. `shop-products.resolver.ts:49-56`, `:109-118`, `:165-174`.
2. T2 (real uncovered route, how-type; main lever): `Collection.productVariants`
   keeps the caller's operator while merging a variant guard; the service only
   hard-ANDs the *product* guard, so a disabled variant of an enabled product
   leaks. `collection-entity.resolver.ts:59-77`. Reason to dismiss: the service
   already re-derives a public guard and the field merges its own.
3. T3 (injected, how-type): `Product.variantList` passes the shop guard to the
   service as list options, and `getVariantsByProductId` skips its implicit
   hard guard when the options look like they already carry it; the caller's OR
   then defeats the merged guard. `product-entity.resolver.ts:77-95`,
   `product-variant.service.ts:194-199`. Reason to dismiss: the service change
   reads as de-duplication and the resolver visibly adds the guard.
4. T4 (injected, route where protection never existed / wrong object):
   `Query.productVariants` (new shop listing) filters the variant's own flag,
   the object in hand, and never the disabled product that owns it.
   `shop-products.resolver.ts:62-72`, `product-variant.service.ts:110-125`.
   Reason to dismiss: a guard named `enabled` is visibly applied.

## Candidate sibling sites considered (injected track)

Real upstream routes/sites found at the pinned commit:

- `Collection.productVariants` (chosen as T2) - caller OR defeats the merged
  variant guard; selected because it is real, two layers deep, and the service
  guard makes it look safe.
- `Product.variants` / `Product.variantList` - the service hard-ANDs the
  variant guard, so they are safe as shipped; turned into T3 by a realistic
  refactor that moves the guard into the options.
- `Query.product` / `Query.collection` / `Query.facet` by id - post-hoc
  checks; correct. Modifying them would have been a wrong-object injection that
  breaks an existing project e2e test (shop-catalog asserts null for a private
  collection), so not used.
- `Product.facetValues`, `ProductVariant.facetValues`, search plugin
  facetValues/collections - post-hoc private-facet filters; correct, and the
  existing project e2e covers them.
- `Collection.productVariantCount` - a count, not entity data; out of the
  property as written.
- `Collection.parent` / `Collection.children` - hand-written private filters;
  correct, and covered by the project e2e.
- Default search plugin strategies - `enabledOnly` is a hard AND on every path;
  no leak.

Injected siblings considered:

- Move the `product(id)` post-hoc enabled check into a filter merge (screener
  O8b). Rejected: the single-item query has no caller list options, so the
  merge cannot be OR-defeated.
- A shop-only `Collection.products(options)` field (screener O8b). Rejected: no
  product-by-collection service exists and `ProductFilterParameter` has no
  collection field, so the code would look contrived rather than left behind.
- A filterOperator-aware guard in the search plugin's facetValue/collection
  counts. Rejected: heavy indexing setup at test time and the post-hoc filters
  are already correct; no natural leak.
- `Product.variantList` guard moved into options (chosen as T3): the smallest
  realistic consolidation, two files, and its dismissal is a mechanism
  ("the options already carry it"), not a location.
- New shop `Query.productVariants` (chosen as T4): a plausible next feature and
  the only candidate that leaks with the default operator too (wrong object:
  variant vs owning product).
- Removing the service's shop variant guard entirely (rejected): breaks the
  existing project e2e test `shop-catalog` and makes the find trivial (red
  test).

## What was verified

- Both published sites and T2 reproduce behaviourally on the pinned copy with a
  real in-process Vendure server, Shop GraphQL client and sqljs database; T3
  and T4 reproduce on the injected tree.
- The injected tree keeps the project's own tests green: `shop-catalog.e2e-spec`
  18/18 and `list-query-builder.e2e-spec` 112/112, before and after the oracle.
- Hidden suites: injected tree security 0/7, functional 17/17; oracle security
  7/7, functional 17/17.
- Every check patch was applied to the injected tree and run locally with both
  suites: 6 security_fail (T1-only, T2-only, T3-only, T4-only, published-only,
  products-only), 4 functional_fail (force-AND, refuse-OR, crash-on-OR,
  global-AND), 2 pass (hardening, alternative), each with the declared outcome.
- `fix.patch` applies with `patch -p1` to the injected tree and reproduces the
  oracle files exactly; `injection.patch` applies to the pinned checkout.

## Gate results

- static: PASS.
- nop: PASS (security 0/7, functional 17/17, reward 0.0).
- oracle: PASS (3 runs, reward 1.0, identical 24/24 each).
- patches: PASS (6 security_fail, 4 functional_fail, 2 pass, each as declared).

## What could not be verified here

- The gate stages above were run with Harbor/Docker; no separate manual Docker trial was done.
- The blind-fix patch is produced after this build by the blind agent.
- Upstream release tags after master were not enumerated; `present_in_latest`
  for the real route was read from upstream master (the guard merge is still
  there).

## Out of scope noticed

- Upstream master still carries the `Collection.productVariants` guard merge
  (same code as the pinned commit); noted only, not built on.
