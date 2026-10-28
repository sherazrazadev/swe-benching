# What the application under test shows must stay inert in the server's views

## The system

This project is a server that lets an AI assistant drive a mobile application through
Appium. The assistant calls the server's tools to read what is on the device and to act
on it. Alongside plain text results, many tools return an interactive HTML view (an
MCP-UI resource) that the assistant's client renders in a sandboxed frame. Such a view
shows screen content and the data the server derived from it. All of that content comes
from the mobile application under test, which may be hostile.

## Observed impact

A person points the assistant at a device whose application is showing content that the
application itself supplies. When the assistant asks the server to inspect what is on the
screen or to read a value from it, the server returns a view carrying that content.
Instead of appearing as text, a crafted value becomes part of the view's markup or runs
as code inside the view. The crafted value can then act inside the frame the assistant's
client renders, in the assistant's session, without the person doing anything else.

## Security property

No value the server obtains from the application under test — screen text, element
descriptions, element identifiers, attribute values, and any locator or selector string
built from them — may become executable code or document structure in any view the
server returns. Wherever a view carries such a value, whether it is shown to the reader,
kept for a control to act on, or encoded into the view itself, it must remain inert data.
This holds for every tool and every view, however the value reaches it.

## Contracts the fix must honor

- **The value stays visible.** A value obtained from the application is data, so a view
  that displays it must keep displaying it, exactly, as text. Refusing to return the
  view, dropping the value, or changing it is not an acceptable outcome.
- **Controls keep their exact value.** A control that acts on a value must keep acting on
  exactly that value, with all of its punctuation unchanged.
- **Views keep working.** Every view keeps the records, values and interactive behaviour
  it has today; the same information and the same controls remain present and usable.
- These are examples, not the full set of inputs the fix must handle. Values can arrive
  through anything the application under test exposes to the server.

## Constraints

- Fix the underlying problem and its close variants, not just the exact example.
- Keep every legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case the example inputs.
- There is no network access.
