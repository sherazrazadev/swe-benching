# Problem report: remote callers can make the host act on their behalf

9router is a local AI gateway and dashboard. It runs a web application on the operator's machine: it proxies model requests, stores provider credentials, configures other local AI tools, and offers a few maintenance actions that operate the machine itself (installing and driving tunnel software, updating or stopping the service, importing credentials that desktop applications keep on the machine).

## Impact observed

From a laptop on the same network, with an ordinary dashboard login, I could start the host's privileged installer. I sent the install request with the header that states where the request came from set to `localhost`, and the server treated it as a request from the machine itself: the installer ran and its progress stream came back to my laptop. Nothing about my client was on that machine. The same class of request reaches other operations that act on the host.

## The rule that must hold

A request may cause the server to act on the host only when it proves that it holds the machine-local secret: the token the product's own command-line client derives for this machine and sends to the local server. Being logged in to the dashboard is not that proof, and neither is any statement in a request about where the request came from (host, origin, forwarded-for or similar headers). Acting on the host means: starting, stopping, updating or otherwise controlling host processes or services; running commands on the host; and reading, copying or otherwise exposing credential material, the machine secret itself, or other secrets that the product, the operating system or other applications on the machine keep.

Separately, every API operation that is not one of the product's explicitly public, pre-login operations must be refused unless the request presents an operator credential: a dashboard session or the machine-local secret. For those operations, a caller's claim about the address or origin it came from must play no part in the decision.

Refusals must be a client error returned by the access decision itself, with no action performed and no host state changed. The exact status code does not matter.

## What must keep working

- The local command-line client, presenting its token, keeps reaching every operation it reaches today, including all of the host operations above.
- Local first-party callers that use the product's model API on the machine itself keep working without a dashboard session or an API key.
- The operations the login screen needs before anyone has signed in keep working without a session.
- A logged-in dashboard user keeps reaching ordinary data operations (settings, keys, providers, models, usage, combos, proxy pools and the like) and read-only status information about the host's services.
- A deployment that has deliberately switched dashboard login off keeps its ordinary data operations exactly as today. The rule above still applies to host operations.
- A caller that presents the right credential sees no change in any operation.

The examples above are examples, not the list of places the rule applies to. Treat the rule as covering every request, route and operation, including ones that are not mentioned here.

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream fix for this issue. Do not special-case the example; the same rule must hold for every operation it covers.
