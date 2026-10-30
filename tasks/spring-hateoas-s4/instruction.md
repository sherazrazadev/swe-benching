# Hidden model properties can be set from a document that is read into the model

Spring HATEOAS is a library that applications use to expose hypermedia representations of their
model objects, and to read such representations back into those objects. An application configures
its JSON mapper with the library's support for one of the hypermedia formats, and the library then
turns the property entries of a document into an instance of the declared model type.

We observed that a client can submit a Collection+JSON document whose item data names a property
that the model hides from input, and that property is written onto the model object anyway. In one
case a hidden administrative flag became true after such a read.

This rule must hold for every document the library converts into an application object, whatever
the supported hypermedia format and however the mapper performing the read has been configured:

- A value supplied by a document must never set a property that the configuration in effect does
  not expose for input. Only the names that configuration exposes may bind values.
- The configuration that counts is the one on the mapper that actually performs the read,
  including configuration supplied to it programmatically rather than declared on the model.

A document that carries such a value may be refused, or the value may simply not be applied.
Either way the value must not reach the object, and a refusal must not leave a partially written
object behind.

Everything the configuration exposes keeps binding exactly as today. A document that mentions only
some of a model's properties leaves the remaining properties unchanged, including values set by
field initialisers and primitive values, and documents of any size keep binding. Values bind under
the names the configuration exposes for them. Links and grouped representations keep working as
today.

The example above is an example, not the full set of formats, shapes or configuration styles:
close the rule, not the example.

There is no network access. Fix the problem and its close variants; keep legitimate use working;
do not look up the upstream fix or existing implementations; do not special-case the example.
