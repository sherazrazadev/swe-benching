# A message recipient can be delivered to a second domain

Nodemailer is a Node.js library for building email messages and delivering them to a mail
server over SMTP. An application gives it a recipient address — often one a user typed or one
taken from a form — and the library parses it, builds the message, and tells the mail server
where to deliver.

## Observed impact

An application validates the domain of a recipient and then hands that recipient to the
library. When the mailbox is written in quotes and is followed by a comment and another
domain, the library reads the whole text as one address, and the address the mail server is
asked to deliver to carries the second domain. The application checked `good-corp.com`; the
message is delivered somewhere else.

One value that shows it:

```
"user"@good-corp.com(x)evil.com
```

## Required behaviour

For every message, each address the library gives the mail server to deliver to must denote
exactly one mailbox: one local part and one domain. Text that accompanies a mailbox may be
kept as its display name, but it must never become part of the delivery address. This holds
for every way a recipient can reach the library, and for every message the library builds or
sends.

A value like the example is not an error: it names the mailbox before the comment, and that
is the mailbox to deliver to. Whatever surrounds that mailbox may be preserved as its display
name.

Everything that works today keeps working exactly as today. In particular:

- ordinary addresses, display names, comments after an address, groups and multiple
  recipients keep parsing, rendering and delivering as they do now;
- everything inside the quotes of a quoted mailbox — spaces, escaped quotes and `@` — stays
  part of its local part, and the quoting that makes it a single unambiguous mailbox is
  preserved all the way to delivery;
- addresses and names that are already valid are otherwise unchanged.

The example above is one instance, not the full set of affected values.

## Constraints

- Fix the problem and its close variants, not only the example.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example (its local part, domain or comment).
- There is no network access.
