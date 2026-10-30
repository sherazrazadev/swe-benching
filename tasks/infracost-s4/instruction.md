# A configured Terraform credential can be sent to a host named by the scanned project

`/workspace` holds Infracost, a CLI that scans infrastructure-as-code projects and estimates
their cloud cost. It uses Terraform Cloud/Enterprise API tokens and Terraform registry tokens
that the operator configures.

## Observed impact

Scanning a Terraform project supplied by someone else made Infracost send the operator's
configured Terraform Cloud token to a host named inside that project. Whoever wrote the scanned
project therefore receives a credential that belongs to the operator's Terraform Cloud/Enterprise
account.

## Required behaviour

- A credential that Infracost is configured with — a Terraform Cloud/Enterprise API token or a
  Terraform registry token — may only be sent to the host or hosts that credential belongs to:
  the host the operator configured for it, or the well-known public host or hosts of that
  service when none is configured. No other host may receive it.
- When a credential would be sent to a host it does not belong to, it must not be sent there.
  The operation may return an error or continue without the credential; it must never deliver
  the credential to the wrong host.
- One invocation may involve several hosts, some trusted and some not. Every legitimate one must
  keep working in the same invocation that refuses the illegitimate one.
- Everything that works today keeps working exactly as today: a host the operator configured
  (including a private Terraform Enterprise or private registry host) keeps receiving its
  credential, credentials configured for individual hosts keep being used for those hosts, and
  the public hosts keep working.

The example above is an example, not the full set of cases.

## Constraints

Fix the problem. Keep legitimate use working. Do not look up the upstream fix.
