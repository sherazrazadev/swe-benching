# Directive host bindings can bypass element-level sanitization

Angular applications commonly use directives that declare bindings in their host metadata: when
the directive is attached to an element, Angular writes the bound value to that element. Angular
decides which sanitization such a binding needs and refuses bindings that would be unsafe on the
element they run on.

That protection is applied inconsistently. A component can attach a reusable directive to an
element of a different kind than the directive was written for — for example, a directive that
binds an attribute in its host metadata is used on an `<iframe>` whose bindings should have been
sanitized or refused. The value supplied by the page is then written into the document unchanged,
and markup supplied by an attacker runs in the application's origin.

**Security invariant.** Whenever a directive or component writes a value through a host binding,
Angular must apply exactly the protection that the same binding written on that element in a
template would receive: a value that would be sanitized there must be
sanitized, and a value that would be refused there must be refused. This must hold for every
directive and component, for every attribute or property bound in host metadata, and for every way
a directive or component can come to run on an element, whatever that element is.

**Static-only attributes.** Some attributes are only permitted as static text on particular
elements. Supplying one of those attributes as a binding must be refused whenever the binding runs
on such an element, whichever directive or component declares the binding.

**Refusal form.** A binding that is refused must raise an error and must not leave the supplied
value in the document.

**Keep working.** Values bound to attributes that are not security-sensitive on the element the
binding actually runs on must be written exactly as supplied, including values that look like URLs
or markup. Ordinary safe values — plain text, safe URLs and safe markup — and static attributes
must keep working exactly as they do today.

The example above is one trigger, not the complete set of cases: the same problem can be reached in
more than one way, and a fix must cover the invariant as stated. Do not look up the upstream fix.
Do not special-case the example; fix the problem and its close variants without changing
legitimate behaviour.
