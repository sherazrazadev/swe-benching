# OAuth discovery trusts metadata for a different protected resource

`rmcp` is the Rust SDK for the Model Context Protocol. Applications use it to
connect to MCP servers over HTTP; when a server requires OAuth, the SDK
discovers the server's authorization configuration before it authorizes any
request.

## Observed impact

I pointed an MCP client at `https://mcp.example.com/mcp`. The server's 401
challenge led the client to a protected-resource metadata document that named
`https://real.example.com/mcp` as its resource and advertised
`https://attacker.example.com` as the authorization server. The client accepted
the document, discovered the attacker's endpoints, and built the authorization
request around them. Nothing checked that the document described the server the
client was configured for.

## The property

The client must never bind an OAuth operation to a protected resource other than
the MCP server's own address. A protected-resource metadata document that does
not identify that server as its resource must not determine which authorization
server is used, which permissions are requested, or which resource a token is
requested for; the value must be refused before any authorization-server or
token request is sent. This holds for every value that reaches the client,
wherever it comes from.

Two resource identifiers denote the same resource only when they are identical,
except that an identifier whose path is just the origin may be written with or
without a trailing slash. Any other difference - a different path, query,
fragment or host - denotes a different resource.

## Requirements

- A refusal is an error: no authorization-server discovery request,
  authorization request or token request may be sent for the rejected value, and
  nothing derived from a rejected document may affect a later request.
- Everything that works today keeps working exactly as today: metadata published
  at the well-known locations the SDK already supports, servers identified by a
  bare origin, and values that legitimately describe the same server supplied in
  more than one place.
- The example above is one example, not the full set.

Fix the problem and its close variants. Do not change ordinary behaviour for
valid servers and do not special-case the example.
