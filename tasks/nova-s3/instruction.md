# Files injected into a server image can land outside it on the compute host

## System

Nova is the OpenStack compute service. When a cloud user creates or rebuilds a
server, the request may carry a "personality": a list of files, each a target
path and its contents, that the compute host writes into the server's disk
image before the server boots. The compute service also writes other data a
server needs at boot into the same image. The host mounts the image it is
preparing and writes into it with the privileged account the compute service
runs as.

The image being prepared is not necessarily trusted. It can come from a
tenant-supplied image or have been changed at any earlier point, and its
contents, including its directory structure, are not trusted.

## Observed impact

A user who may create servers can make the compute host write outside the disk
image it is preparing, as its privileged account. For example, a personality
entry whose path is

    ../../etc/nova/host.conf

is written to a host path outside the mounted image instead of into the guest
filesystem.

## Security property that must hold

Nova must never create, overwrite, append to, truncate, change the permissions
or ownership of, or otherwise modify any file or directory outside the root of
the filesystem it is injecting into. This must hold whatever values the caller
supplies, and whatever the image itself already contains.

If a request cannot be served without such an outside change, it must be
refused: the call fails with a client error, and nothing outside the image is
created or changed.

## Contracts the fix must honor

- **Refusal form.** A refused request reports a client error and does not
  succeed; it does not kill the worker.
- **Preservation.** Everything that works today inside the image keeps working
  exactly as today. A target that resolves inside the image is still written,
  including one that starts at the image root or that contains
  parent-directory segments resolving back inside. Where the product appends
  today, it still appends, so content already in the file survives. Where it
  replaces a file today, it still replaces it rather than duplicating it.
  Parent directories are still created, several files may still be injected in
  one request, and a file may still be placed in a new, deeply nested
  directory inside the image.
- **Locations reached from inside the image remain usable.** A path that
  arrives at a location inside the image through an entry the image already
  has is legitimate and must keep working.

The example above is one instance, not the full set of ways the property can
be violated.

## Constraints

- Fix the flaw and its close variants, not just the request shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
