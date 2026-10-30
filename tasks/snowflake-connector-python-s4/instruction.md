# Server identity is not verified on the connector's TLS connections

The Snowflake Python connector is a database driver: application code uses it to open a session to
Snowflake and run queries, and internally it makes HTTPS requests to the account's host and to a
few related endpoints. Every one of those requests is protected by TLS.

Today the connector accepts a TLS server whose certificate does not belong to the host it was asked
to connect to. A peer that can present any validly chained certificate — for example a machine on
the network path — is treated as the intended server, and the request is sent to it. Reproduce it
by opening a connection to a host that serves a certificate for a different name: the request goes
through instead of failing with a TLS error.

The connector must guarantee, for every TLS connection it opens on a caller's behalf:

- The peer certificate covers the server name the connection was requested for. A certificate that
  does not cover that name, or a connection whose peer identity cannot be established, must be
  refused with a client error and no request sent.
- The TLS settings the caller supplied — the minimum protocol version, the verification strictness,
  and whether certificate verification is enabled — are preserved when the connector prepares its
  own TLS configuration. A caller who asked for a stronger setting must never end up with a weaker
  connection.
- A caller that explicitly turns certificate verification off keeps connecting exactly as it does
  today, including when no server name is available.

The server name may be a DNS name or an IP address, in any form the connector accepts. Connections
that work today, and caller settings that work today, must keep working exactly as they do today.

These examples are examples, not the full set: fix the problem and its close variants. Do not look
up the upstream fix. Do not special-case the example.
