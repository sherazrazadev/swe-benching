# A pack's content must be proven before it is used

## The system
`nono` runs a command inside a capability sandbox. Teams publish *packs* through a registry:
signed collections of sandbox profiles, policy content and other files. Installing a pack leaves
a local record of what was installed — the pack's files and their digests, the identity of the
signer, and the stored signature material — so later commands can check that the pack on disk is
still the one that was installed. No registry is contacted at run time: the local record and the
stored signature material are the whole proof.

## Observed impact
A pack directory is present on the machine but its local install record is gone (for example a
migration dropped it, or the directory was copied from another machine). The operator runs

    nono run --profile acme/widget -- some-command

and the tool reports the pack as verified and starts with the filesystem access the pack's
content asks for — including paths the operator never granted — instead of refusing.

## What must hold
A pack's content may influence what the tool grants, denies, reports or writes only after the
tool has established that the pack is the one recorded at install time. For the pack the tool
actually takes content from:

- an install record for that pack exists;
- the record names its signer, and the pack's stored signature material is present;
- every digest the record holds matches the file on disk; and
- every file the tool takes from the pack is covered by one of those recorded digests.

If any of these is absent or does not match, the operation is refused: it reports an error and
exits unsuccessfully, and none of that pack's content affects anything — no capability is
granted or reported, and nothing is written.

## Contracts the fix must honour
- **Refusal.** A refused operation fails with an error and leaves no side effect. It is not a
  crash and not a silent skip.
- **Preservation (works exactly as today).**
  - A pack with a complete, consistent record and its stored signature material present keeps
    working on every command that uses it: it is reported as verified and its content has exactly
    the effect it has today.
  - A profile that names a pack which is not installed at all keeps working as today.
  - A profile that uses no pack content keeps working unchanged.
  - Everything else that works today keeps working exactly as today.
- **Interfaces.** Existing command-line forms and their output keep their current shape.

The samples above show how the flaw appears; they are not an exhaustive list. Reason about the
property, not the samples.

## Constraints
- Fix the flaw and its close variants, not just the sample.
- Keep every legitimate use working.
- Do not look up the upstream fix for this issue.
- Do not special-case the example inputs.
- There is no network access.
