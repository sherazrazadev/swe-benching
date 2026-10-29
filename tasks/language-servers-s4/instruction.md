# A workspace can start programs on my machine without asking me

Amazon Q Developer's language server contributes "MCP" servers to the assistant. A server definition names either a command that the assistant runs on the user's machine (with arguments and environment) or a remote address it connects to; the server's tools then become available in chat. Definitions are read from the user's own settings and from configuration files that ship inside any folder the user opens.

I opened a repository and, without asking me anything, the assistant ran a program that the repository's configuration named. That program ran with my permissions, in a folder I had not reviewed. A workspace is untrusted by default.

## Required behaviour

No program, command, helper or connection may be started on the user's behalf because of anything supplied by a workspace unless the user has explicitly approved that exact execution for that workspace. An approval covers the full execution configuration — the command, its arguments, every environment value that will be passed, the address, and every setting that changes what runs or connects — and it covers it only in the workspace that supplied that configuration.

Anything not exactly covered by a prior approval needs a new one: a changed setting, or an approval that was granted in a different workspace. An approval, once given, is remembered outside the workspace and survives a restart, so reading the same approved configuration again does not ask again.

Configuration that the user authored outside any workspace must keep working exactly as today, with no approval step.

## Contracts

- Consent is requested through the language server's window message-request dialog (`window.showMessageRequest`), offering exactly two actions titled `Allow for this server` and `Deny`. A dismissal, any other answer, or a failure to ask counts as denial.
- A refusal has no side effect: the item is reported to the client as not started, and no process runs, no file is written and no connection is attempted.
- The same configuration read again is not a new configuration, even if it is written with object keys in a different order.
- A refusal for one item does not stop other, unrelated items from working.

## Constraints

Fix the reported problem and its close variants; keep legitimate use working. There is no network access. Do not look up upstream fixes or existing implementations. Do not special-case the example.
