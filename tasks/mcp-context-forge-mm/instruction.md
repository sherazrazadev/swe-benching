# Stored templates can expose the gateway's Python runtime

## System

This is an MCP gateway and registry. It stores reusable content on behalf of teams and serves it
to MCP clients. Clients author and retrieve stored content over the gateway's HTTP and JSON-RPC
API.

## Observed impact

A user who may author a prompt can store a template and then request that prompt with arguments;
the text the gateway returns may expose the gateway's own Python objects, classes and methods.

## Properties that must hold

- No template text that the gateway renders may evaluate or expose the gateway's Python objects,
  classes, modules or attributes. A request that would do so is refused with a client error and
  leaves no prompt, resource or other state created or changed.
- This holds for every template the gateway holds and every rendered response, however the text
  reached the gateway.
- Legitimate template use keeps working exactly as today: plain text, variables, loops, filters and
  conditionals, and any placeholder syntax that existing prompts already rely on.
- Ordinary prose is not template code. A template that merely contains ordinary words or symbols
  that look like code must be accepted and returned unchanged; variables, loops, filters and
  conditionals must keep rendering.

## Requests and responses

- A refusal is a client error (HTTP 4xx) or the protocol's error member, with no side effect.
- Prompt arguments are supplied as a JSON object whose values are strings.
- Rendered output is returned in the response field the current API already uses for that output.

## Constraints

Fix the problem and its close variants; do not special-case one payload. Keep legitimate use
working. Do not look up the upstream fix or existing implementations. There is no network access.
