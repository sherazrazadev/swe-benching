# Security report: caller-chosen file names in the MCP servers

## What the product is

This project is a Node.js toolkit that exposes numerical solvers and consciousness-exploration
features through Model Context Protocol (MCP) servers, an embeddable SDK, and command-line
tools. Several tools persist data to a file whose name the caller supplies, and other tools load
data back from such a file.

## Observed

An MCP client called the state export tool (`export_state`) with a destination outside the
service's own storage area. The service wrote its state file at that destination, replacing a
file that belonged to another program.

## Required behaviour

For every file that an MCP server in this product creates, overwrites or reads on behalf of a
client, the client may choose only a name inside the dedicated directory that the feature
reserves for that kind of data.

No value supplied by a client may cause a file outside that directory to be created, overwritten
or read. This holds whether the value is the file-name argument itself or any value from which
the service builds a file name or path, and it also holds when the chosen name is a link that
points somewhere else.

A value that would take the file outside the reserved area is refused. The refusal must be a
client error — not a crash — and must leave nothing behind: no file and no directory outside the
reserved area, and no change to any existing file.

This is a constraint on the value, not on the feature: an ordinary name such as `state.json` is
still accepted, still round-trips, and may still be written over an existing file of the same
name.

## Must keep working

Everything that works today keeps working exactly as today. In particular:

- Valid names save and load in both directions for every persistence feature.
- Programs that embed the SDK and persist state to a destination path they choose keep writing
  and reading at that path.
- Ordinary file-name characters (letters, digits, dots, dashes, underscores) keep working.

## Scope

The example above is one observed trigger, not the full set of affected features. Fix the
problem and its close variants; keep legitimate use working; do not look up the upstream fix; do
not special-case the example.
