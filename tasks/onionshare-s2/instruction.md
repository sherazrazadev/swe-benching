# Sharing must not disclose files outside the shared folders

## The product

This project shares files from one machine with other people over a private web address. The user
picks one or more files and folders, or publishes a folder as a small website, and the application
serves them. A recipient sees a listing of what is available and can fetch one file or the whole
share, and a client may ask for only part of a file.

## What happened

A user shared a folder that also contained a shortcut pointing at a file elsewhere on the machine,
outside anything the user had chosen. A recipient was able to fetch that outside file's contents
through the share. The application treated the shortcut as the file it named, so the outside file
was served as if it were part of the share.

## The rule

No one may obtain the contents of any file that really lives outside the locations the user is
sharing, through any request the application answers. This holds for every file the share offers
and for every way the application offers it, and it holds however that entry came to be part of the
share. A file whose real location is inside a shared location is not outside it.

## Refusal

A request that would disclose content from outside the shared locations is answered without that
content and with no other effect. Where the application refuses, it answers with a client error and
never falls through to a server error.

## What must keep working

Everything that works today for legitimate shares keeps working exactly as it does today, with the
same listings and the same downloads and bundles, for ordinary files and for nested folders.

An entry that must not be served must not take the rest of the share with it. A share that mixes
ordinary files with one that points outside must still deliver all of its ordinary files, in every
form the share offers them, and must still let a recipient browse its folders. A share that is a
single ordinary file must still deliver that file.

The example above is an example, not the full set of inputs the fix must handle.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example input.
