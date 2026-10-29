# Process Compose — the local control interface must trust only local clients

Process Compose is a local process supervisor. It runs the processes declared in a
configuration file and exposes their state and controls over HTTP to local clients:
starting, stopping, restarting and scaling processes, and reading process state and logs.
Some controls are also exposed as built-in MCP tools when the operator enables them.

## Observed impact

A page on another website can drive the local control interface from the developer's
browser. One concrete trigger: the page's own host name is re-pointed at the developer's
machine, and the page requests the MCP streaming URL documented for clients,
`http://<host>:<port>/sse`. The product accepts the request as an ordinary local client,
so the page can invoke the built-in controls and, for example, stop a running process.

## The rule

Only a request from a trusted local client may reach the product's local HTTP control
interface — whether to make an operation happen or to read the process state and log data
it exposes. A request is trusted only when:

- the host it is addressed to names the local machine — any loopback address, or
  `localhost` — or is a name the operator has explicitly listed in the MCP server's
  `trusted_hosts` setting;
- an `Origin` header, when the request carries one, names such a host too; and
- when an access token is configured (`PC_API_TOKEN`), the request presents it.

Every other request is refused and has no effect. The request and host above are examples,
not the full set of requests the rule covers.

## Contracts the fix must honour

- **Refusal.** A refused request gets a client error. It must leave no side effect:
  nothing is started, stopped or changed, and no process state or log data is returned. A
  crash or a server error is not a refusal.
- **Token form.** A configured token is presented as `X-PC-Token-Key: <token>` or
  `Authorization: Bearer <token>`; the scheme name is case-insensitive.
- **Keep working.** Clients on the local machine keep working with no configuration. A
  listener deliberately bound to a non-loopback address keeps working for clients that
  address it by a name listed in `trusted_hosts`; an explicit `trusted_hosts: ["*"]` is a
  documented opt-out that disables the host and origin check. Long-lived streaming
  sessions keep streaming, MCP clients keep connecting and invoking tools, and everything
  else that works today keeps working exactly as today.

## Constraints

- Fix the flaw and its close variants, not just the request shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
