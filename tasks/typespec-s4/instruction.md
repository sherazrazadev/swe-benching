# Generated output can be written outside the chosen output directory

TypeSpec is a language for describing APIs. Its compiler runs emitters, and each emitter writes
the files it generates into an output directory chosen by whoever runs the compilation.

## Observed impact

Compiling a spec whose declared version contains path separators, then emitting it with the
OpenAPI 3 emitter and an `output-file` template that places the version in a directory, writes the
generated document outside the output directory. A spec author who controls the spec therefore
controls where the compiler writes.

## Security property

No name that the author of a spec writes may cause a compilation to create, change or remove
anything outside the output directory the caller chose — whatever emitter or option uses the name,
and whatever text the name contains.

## Contract

When a supplied name cannot be used as a path, the emitter must keep the generated output inside
the output directory, by changing or dropping the unsafe part of the name, and keep emitting. The
compilation must still finish: it must not fail, and it must not leave anything outside the output
directory.

## Legitimate use that must keep working

Names that are safe path text keep producing the same file and directory names, including names
that contain dots such as `Pet.Store`, `1.0.0`, `2021-10-01-preview`, `..dir` and `dir..`. Output
templates that place a name inside sub-directories keep their separators. Documented output
layouts keep their existing shape. Generated output that refers to other generated output keeps
pointing at the files actually produced.

The examples above are examples, not the full set. Fix the problem and its close variants; keep
legitimate use working; do not look up the upstream fix; do not special-case these examples.
