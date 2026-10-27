# Gitea

Gitea is a self-hosted Git service. Repositories publish releases, and a release can carry files
that visitors download. An operator can configure which file types may be distributed as release
assets; a deployment that permits only archives, for example, must not distribute anything else
from a release.

## Impact

A repository writer made a file of a type the operator does not permit for release assets part of a
published release. The writer uploaded the file through an ordinary attachment form that accepts
it, then attached the already stored file to an existing release while editing that release. The
file was listed and served with the release even though its type is outside the configured set.

## Security property

A file whose name is not of a type this installation allows for release assets must never become
part of a release, and nothing may make it downloadable as a release asset. This holds for every
stored file that ends up in a release, whatever it was stored for and whichever path attaches it.

## Contracts

- A request that is refused answers with a client error (any 4xx) and changes nothing: the file
  does not become part of the release, and no existing attachment, linkage or stored name is
  altered.
- Everything that works today keeps working exactly as today. In particular:
  - when the installation configures no restricted set of types for release assets, any file may
    still be attached;
  - a file of an allowed type still attaches and can still be downloaded from its release;
  - files stored by older versions of the product, including files recorded without an owning
    repository, remain attachable;
  - names are still validated when they are changed;
  - other uses of attachments keep working unchanged.
- The type set configured for release assets is the one that governs release assets, including
  files that were stored for a different purpose.

These rules hold generally, not only for the example above. Fix the problem and its close
variants, keep all legitimate use working, do not look up the upstream fix, and do not
special-case the example.
