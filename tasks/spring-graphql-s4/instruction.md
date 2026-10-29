# Unsafe deserialization in paginated GraphQL queries

## Background

This project is a library for building GraphQL services on Spring. Applications use it to expose
paginated `Connection` fields: a client asks for a page by sending `first`/`last` together with an
opaque cursor in `after`/`before`. For keyset pagination the library encodes the values of the
last-seen row into the cursor, and decodes the cursor a client sends back into a position before
fetching the next page.

## Observed issue

During an audit we sent a paginated query whose cursor, once decoded, named a class from the
application's classpath. The server instantiated that class while decoding the cursor and the
query completed normally. The class we used did nothing except run its constructor; a class
capable of more would have run that instead, so a request of this shape can execute logic chosen
by the client.

## Required property

No value supplied by a client may cause the pagination feature to instantiate a class that the
feature does not itself use. A cursor may decode only into the plain container types that carry a
position and the ordinary value types a position can hold; any other class named by a cursor must
be refused and never constructed. This holds for every cursor form the application accepts and for
every supported way of configuring the feature.

## What must keep working

- Everything that works today keeps working exactly as today: ordinary paginated queries and their
  cursors still round-trip, including positions whose key values are dates, calendar values,
  UUIDs, numbers, `java.time` values and enums, and positions whose keys are held in an
  unmodifiable map.
- A request whose cursor names any class outside that set fails with an error and has no side
  effect; the refused class is never constructed.
- A request whose cursor carries an ordinary position decodes and serves the next page.

The cursor described above is one example, not the full set of accepted inputs.

## Constraints

Fix the vulnerability and its close variants. Keep legitimate use working. Do not look up the
upstream fix or an existing implementation. Do not special-case the example. There is no network
access.
