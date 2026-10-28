# Cline local services: any web page can drive the local runtime

Cline is a coding assistant that runs on the user's machine. Its front ends talk to local services
to run and configure agent sessions.

## Observed impact

While a local service is running with its default local configuration, a web page visited in the
same browser can make the local runtime perform privileged actions, even though the page was not
served by the deployment.

## Security property

A local service must run or configure an agent session only for a request that comes from a page
the deployment itself serves. A request that does not present a usable origin naming an address the
deployment is configured to serve must be refused with a client error before any action, state
change, or reply. A request whose host does not name the deployment must likewise be refused.

Apart from a front end the product itself ships and serves, an address is one the deployment serves
only when its scheme, host and port are the deployment's own; being on the same machine is not
enough.

Serving the deployment's own pages and the resources they load is not such an action; they must keep
loading for a browser that sends no origin, exactly as they do today.

Everything that works today must keep working. In particular:

- requests from a page the deployment itself serves must still be accepted;
- a connection from a front end that the product itself ships and serves keeps working in whatever
  address form that front end presents;
- a connection that uses the deployment's configured public address must keep working in whatever
  form clients and the configuration present it.

The examples above are examples, not the full set: the property applies to every way a request can
reach one of these services.

## Constraints

- Fix the reported problem and its close variants: a request that can drive the runtime must not
  bypass the check regardless of how the request arrives.
- Keep all legitimate use working, including every preservation clause above.
- Do not look up the upstream advisory or its fix.
- Do not special-case the example in this report.
