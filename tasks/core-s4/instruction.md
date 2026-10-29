# A reference to an object of the wrong kind is accepted

The service is a framework for building hypermedia APIs. A resource class is published as a set of
HTTP operations, and a client writes an item by sending a document in one of the representations the
API accepts. A relation to another resource is written as a reference -- normally an absolute IRI
such as `/comments/1` -- and the API resolves that reference to the object it names before attaching
it to the relation.

We observed a write in which the reference named an object of a different kind than the relation
declares. With a resource whose `relation` is declared to hold a `Post`, this request succeeds:

```
POST /articles
Content-Type: application/ld+json

{"title":"draft","relation":"/comments/1"}
```

The server reports success and the comment is attached to the post-typed relation as though it
belonged there.

The guarantee that must hold is: whenever the API resolves a client-supplied reference into an
object for a place that declares a resource type, the resolved object must be an instance of that
declared type. A more specific subtype is acceptable; any other type must be refused with a client
error, and the request must not write or change anything. This holds for every representation the
API accepts and for every way a reference is carried; the example is one trigger, not the full set.

Everything that works today must keep working exactly as today: references that name an object of
the declared type, references that name a concrete subtype of a declared abstract type or interface,
and writes that leave relations out.

Address the flaw and its close variants rather than the single example. Do not look up an upstream
fix or an existing implementation, and do not special-case the example. There is no network access.
