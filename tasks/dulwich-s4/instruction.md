# Repository content is written outside the directory being filled

## The system

Dulwich is a pure-Python implementation of the Git file formats and protocols. It is used as a library and as a command-line tool, and it works with repositories that come from other people. A repository's commits record file paths, file contents and symbolic links, and dulwich places that recorded content into directories on the user's machine.

Because a repository is untrusted input, the directory an operation is writing into is the boundary: content recorded in a repository must not be able to reach anything the user did not choose to expose.

## Observed problem

A repository can contain one commit that records a symbolic link at some path, and a later commit that records a directory at the same path containing a file. Rewriting the history of that repository with the index-filter mode of the filter-branch command:

```
dulwich filter-branch --index-filter 'true'
```

causes the file from the later commit to be created outside the repository's working directory, at the location the earlier symbolic link points to. Whoever supplied the repository can therefore have the operation create or overwrite a file anywhere the user can write, simply by choosing the link target.

## Security property

No content recorded in a repository — file paths, file contents, symbolic links, or any arrangement of them — may cause an operation that places repository content into a directory to create or modify anything outside that directory. This holds when entries left behind by an earlier operation are still present in the directory, including when a symbolic link that an earlier operation placed there would be treated as a directory by a later write, and it holds for every operation that places repository content into a directory, not only the one first observed.

## Required behaviour

- When an operation cannot place an entry safely, it may refuse: raise an error, or leave that entry out, without creating or modifying anything outside the target directory. An operation that returns normally must also have written nothing outside it.
- Symbolic links recorded in a repository are ordinary content: an operation that places a symbolic link entry into a directory must still create the link there, with the recorded target.
- A symbolic link that already sits at exactly the path where a regular file is to be placed must still be replaced by that regular file, and its link target must not be written through, as today.
- Everything that works today keeps working, with the same files and results, including nested directories and content that has no symbolic links.

The command above is one example, not the full set of operations or inputs.

## Constraints

- Fix the problem and its close variants, not just the example.
- Keep every legitimate use working.
- Do not look up the upstream fix, advisory, or changelog for this project.
- Do not special-case the example.
- There is no network access.
