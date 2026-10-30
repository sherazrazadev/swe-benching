# Importing a Bedrock agent can make the generated project run text from the agent definition

## The system

The project in `/workspace` is the AgentCore command-line tool. It can import an existing
Amazon Bedrock agent into a local project: it reads the agent's definition from Bedrock and
writes a runnable Python agent for one of the supported frameworks. The definition is authored
by whoever created the Bedrock agent, so the text in it is untrusted input to the importer.

## What we observed

Running `agentcore add agent --type import` against an agent whose collaborator instruction
contained a quote sequence and a line of Python produced a project whose generated Python ran
that line when the collaborator tool was used. The instruction was supposed to appear only as
human-readable text. This is one example of the problem, not its whole extent.

## Required behaviour

- Text taken from an imported agent definition must never become executable Python in the
  generated project. Wherever and however it is reproduced, it must stay inert: no value may
  end or extend a construct, start a new statement or expression, or otherwise change what the
  generated code does when it runs.
- This holds for every field of the definition and for every framework the importer can
  generate.
- Text that legitimately contains backslashes, quotes, line breaks or other punctuation must
  still be reproduced faithfully, without being escaped twice or otherwise changed in meaning.
- An import that cannot represent the definition safely may fail with a clear error instead of
  producing output; it must not write output that runs the text.
- Imports whose text contains nothing harmful keep producing the project they produce today,
  for every framework, with the imported text still present.

These are examples of the required behaviour, not an exhaustive list of the fields or constructs
it covers.

## Constraints

- Fix the problem and its close variants in the importer itself, for every field and framework
  it handles. Do not special-case the example's text or field.
- Keep legitimate imports working as described.
- Do not look up or copy an upstream fix for this issue.
- There is no network access.
