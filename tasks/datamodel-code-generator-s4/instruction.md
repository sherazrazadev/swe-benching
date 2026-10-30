# Generated models must not contain code chosen by the input schema

## The system

This project generates Python data models from schema documents. It is used as a command-line
tool and as a library: given a JSON Schema or OpenAPI document, it emits a Python module whose
classes, fields and import statements are meant to describe the schema's data. Schemas are often
produced by another team or supplied by a partner, so the document itself is not trusted content.

The generator is expected to turn declarations in the schema into a faithful description of
data. It is not expected to turn declarations into behavior.

## Observed problem

A team generated models from a schema supplied by a partner:

```
datamodel-codegen --input partner.json --input-file-type jsonschema --output models.py
```

The command reported success, but the generated module contained a top-level statement that
appeared nowhere in the schema's data. The statement had been carried inside a value the schema
used to tell the generator which Python type a field should have. Importing the generated module
executed it.

## Security property

Any value taken from the input schema that the generator turns into a Python name must be a
dotted identifier path: one or more valid Python identifiers separated by dots, with no keyword
among them. This holds for every value the schema supplies for that purpose, however the schema
presents it and whatever the generator calls the declaration.

A value that is not a dotted identifier path must never reach the generated module as source,
either on its own or as a piece of a larger name. Generation must refuse it.

## What refusing means

A refused schema makes the command exit with a non-zero status and an ordinary error message.
It must write no output file, and it must end in a controlled refusal rather than an unhandled
exception.

## Keep working

Everything that works today keeps working exactly as today. In particular:

- A schema may still name a Python type or symbol from any installed third-party package, at any
  dotted depth, and the generated module must still import it and use it as before.
- A schema may still name several such symbols at once, and all of them must keep being imported.
- Text used as data — descriptions, string defaults, enum values, aliases — may contain any
  characters and must keep appearing, escaped, as data.
- Imports that an application asks the tool to add through its own options keep being emitted,
  including a bare module name.

These are examples of what must keep working, not the full set.

## Constraints

- Fix the underlying problem and its close variants, not just the exact example.
- Keep every legitimate use working.
- Do not special-case the example inputs.
- Do not consult any upstream fix or existing implementation for this project.
- There is no network access.
