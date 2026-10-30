# X.509 path validation accepts names outside a CA's permitted scope

The `cryptography` package validates X.509 certification paths: given a leaf
certificate, the intermediates that may link it to a trusted root, and that
root, it builds and checks a chain and honors the limits a CA places on the
names it may issue for.

## Observed impact

A chain is accepted even though a CA in it does not authorize the name the
certificate is used for. Concretely: a CA that allows only `foo.example.com`
will accept a leaf whose DNS subject alternative name is `*.example.com`, and
the certificate is then usable for `bar.example.com`, a name the CA never
permitted. Likewise, a root that permits only one host name still accepts a
certificate for a different host under the same domain.

## The property

A DNS name that contains a wildcard stands for exactly the set of names obtained
by replacing that one label. Validation must treat it as that set and nothing
wider:

- a certificate must not be accepted as valid for a requested name that is not
  in the wildcard's set; and
- when a CA in the path restricts the DNS names it may issue for, a wildcard is
  within the permitted scope only if every name in its set is within that
  scope, and it is outside the excluded scope whenever any name in its set is
  excluded.

No chain that breaks either rule may be accepted.

A CA's name restrictions bind every certificate issued beneath it, including
when the CA's own certificate is self-issued, such as a self-signed root that
carries name restrictions. Being self-issued only exempts a certificate's own
names from restrictions imposed by CAs above it.

## Contracts

- A rejected chain is reported as a verification error; no chain is accepted.
- Everything that validates today for exact DNS names that every CA in the path
  permits and does not exclude, and for wildcard names whose entire set is in
  scope and outside every exclusion, keeps validating exactly as today.
- A wildcard still matches exactly one label when names are compared.
- Names are compared without regard to ASCII letter case.

The example above is one instance, not the full set. Fix the underlying issue
and its close variants.

## Constraints

- Fix the problem and its close variants; keep legitimate use working.
- Do not look up the upstream fix or report.
- Do not special-case the example.
