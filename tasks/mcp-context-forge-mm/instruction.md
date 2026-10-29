# Stored templates can expose the gateway's Python runtime

## System

This is an MCP gateway and registry. It stores reusable prompt templates and resources on behalf of
teams and serves them to MCP clients over HTTP and JSON-RPC. Clients can create prompts and
resources, list them, and ask the gateway to render a prompt with arguments or to return a
resource's body.

## Observed impact

A user who may author a prompt can store a template and then request that prompt with arguments;
the text the gateway returns can contain representations of the gateway's own Python objects,
classes and methods, including memory addresses. The same is possible for other template text the
gateway stores and renders.

## Properties that must hold

- No template text that the gateway renders may evaluate or expose the gateway's Python objects,
  classes, modules, attributes or memory addresses. A request that would do so is refused with a
  client error and leaves no prompt, resource or other state created or changed.
- This holds for every template the gateway holds and every rendered response, however the text
  reached the gateway.
- Legitimate template use keeps working exactly as today: plain text, variables, loops, filters and
  conditionals, and the single-brace `{name}` substitution that existing prompts rely on.
- Ordinary prose is not template code. A template that merely contains words such as "select", or
  symbols such as "&&", must be accepted and returned unchanged; a template with one variable, a
  three-iteration loop and one filter is ordinary and must render.

## Requests and responses

- A refusal is a client error (HTTP 4xx) with no side effect. For a JSON-RPC request the refusal is
  an `error` member of the JSON-RPC response.
- Prompt arguments are supplied as a JSON object whose values are strings.
- A rendered prompt is returned as the text of the message content; a resource body is returned in
  the response's `text` field.

## Constraints

Fix the problem and its close variants; do not special-case the example above. Keep legitimate use
working. Do not look up the upstream fix or existing implementations. There is no network access.
