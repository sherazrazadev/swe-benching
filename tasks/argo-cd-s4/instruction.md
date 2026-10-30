# Repository proxies: a proxy value must stay an address

Argo CD is a GitOps controller. Operators register Git repositories, either directly through the
API or CLI or through stored credential configuration that applies to matching repositories, and the
repo-server talks to those repositories when it connects to them or builds an Application. A repository entry
can carry a proxy address so that the repo-server reaches repositories that sit behind a proxy.

A repository proxy value can be authored by anyone allowed to create or update a repository or stored
credential configuration, which is often a less-trusted project role rather than a cluster
administrator. One operator set an SSH repository's proxy to a host that contained shell syntax;
when the repo-server tested that repository, the host text ran as a command on the repo-server, and
such a command can read the credentials the server holds for other repositories. The same input
must not be able to run anything, and a value the product cannot use as a proxy must not be used at
all.

**Security property (invariant).** A repository proxy setting is untrusted configuration. The
product may use it only when it is a well-formed proxy address: a scheme the product supports for
that repository, a hostname made only of letters, digits, dots and hyphens or a valid IP literal,
and a numeric port from 1 through 65535. Any other value must be refused as a client error with no
side effect, and no part of it may be interpreted by a command interpreter or used to configure a
network proxy. This holds for every repository and for every way the setting can reach the product,
including values kept in stored configuration.

**Contracts**

- A value that is not well-formed is refused as a client error with no side effect: nothing derived
  from it runs, nothing is left behind on disk, and no request is routed through it. An operation
  may instead continue without the proxy, but never with the rejected value.
- A proxy value names the protocol the repository uses: SOCKS5 for an SSH repository, with or
  without remote name resolution, and HTTP, HTTPS or SOCKS5 otherwise.
- A well-formed proxy keeps working exactly as today, including one that carries a username and
  password (the connection still receives the authentication values it needs), one written as an
  IPv6 literal, and ports 1 and 65535. The temporary files the product creates while preparing
  credentials or a proxy are still removed.
- Repositories without a proxy, and repositories that receive their proxy from stored credential
  configuration, keep working.
- Everything else that works today keeps working exactly as today.

The example above is one case, not the full set. Fix the problem and its close variants; do not
special-case the example; do not look up the upstream fix.
