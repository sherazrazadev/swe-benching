# Crafted data must not change other operations, or become live markup

## What this is

This repository is a data-transformation tool used in the browser and in Node.js. A user builds a
recipe: input data is piped through a sequence of operations, and some operations present their
result as a chart or as a table in the output pane. The input to a recipe is untrusted — it may be
pasted in from anywhere — and the same process serves every operation the user runs.

## What was observed

A user ran the Series chart operation on comma-separated input whose first column was the literal
text `__proto__` and whose second column was an HTML fragment. After that operation ran, an object
shared by every operation carried the second column's text, and the text later appeared in the
output pane as live markup rather than as text. Ordinary chart data placed next to it still
displayed correctly.

## Required behaviour

- No text taken from the data a recipe processes may become a property of an object that is shared
  between operations or built into the runtime, whatever that text looks like. Text that happens to
  be spelled like an internal object slot name is ordinary data: it must remain part of the
  operation's own result, not be dropped, renamed or treated specially.
- Whenever a result is displayed as a table in the output pane, the table may contain only the
  fields that are actually present on the data being displayed, and every field name and value must
  be displayed as text: markup characters in them must be escaped, not interpreted. This holds for
  every operation that produces such a table, however the data reaches it.
- A crafted value must not make an operation fail in place of returning its normal result. Charts
  and tables must still be produced.
- Everything that works today keeps working exactly as today. Ordinary series and axis labels —
  including ones containing spaces, punctuation or markup characters — still display; tables still
  show their fields and still expand nested fields into sub-tables; numbers, booleans and empty
  values still display; and a field whose name happens to look like an internal object slot is still
  shown where it is legitimate data.

These examples are examples, not a complete list of the ways the requirement can be violated.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or existing implementations.
- Do not special-case the examples.
- There is no network access.
