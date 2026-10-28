# Notification emails treat supplied text as markup

## The system

This repository is a community question-and-answer platform. People register, confirm their
address, reset a password, post questions and answers, comment, invite others to answer, and accept
answers. The platform sends email for these events: account activation, password reset, address
confirmation, and messages telling a subscriber that someone answered, commented on, invited them,
had an answer accepted, or had a question closed. Each message is a fixed HTML body with details
about the recipient and the person who acted, the question, and one or more links filled in.

## Observed impact

A signed-in person chooses their display name and the text of their questions freely. When one of
those values contains HTML markup, the notification email that other people receive carries that
markup as live HTML instead of as text. A mail client that renders HTML then treats the sender's
text as part of the message structure, so the author of the text can shape what the recipient's
mail client shows and does.

## What must hold (invariant)

Whenever the platform produces an email from values that people have supplied to it, no such value
may be treated as markup. A supplied value must appear as inert text, or be left out; it must never
become an element, an attribute, or script in the message. This holds for every email the platform
sends, for every supplied value in it, and however that value reaches the message: whether it is
used immediately, or was stored earlier and read back.

## Contracts the fix must honour

- **Inert values.** A supplied value that carries markup must not survive as markup in the body.
  Either the value is shown as text (its characters no longer read as tags) or the markup is
  removed; both are acceptable.
- **The message's own structure and links are preserved.** Everything that is part of the
  notification itself keeps working exactly as today: the body's line breaks, quoted-excerpt blocks,
  emphasis and links stay real HTML, and every generated link still points to the same address it
  points to today.
- **Plain-text contexts are unchanged.** A subject line is not HTML: it keeps showing the supplied
  values exactly as they are, including characters such as `&`, `<`, `>` and quotes.
- **Legitimate values keep working.** Ordinary names, titles, tag lists and stored values render
  normally: a legitimate value of an allowed length that contains ordinary punctuation is shown to
  the recipient as the same text. Display names are 2–30 characters and question titles 6–150, and
  a legitimate value of that size must be unaffected.
- The rendering entry points the product already exposes, and the data they receive, stay in place;
  fix them where they are.

The example above shows the shape of the problem; it is not the full set of inputs that must be
handled.

## Constraints

- Fix the problem and its close variants. Do not special-case the example.
- Keep legitimate use working exactly as it does today.
- Do not look up or use the upstream fix.
- There is no network access.
