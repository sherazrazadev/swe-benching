# An agent's file tools can act outside the workspace directory they were given

Langroid is a Python framework for building LLM agents that call tools. Its file tools are tool
messages an agent can use to work with files: each tool is created bound to a workspace
directory, and the agent supplies the paths the tool acts on. We use them so that an agent can
maintain a project tree.

While exercising an agent configured with a workspace directory, we asked one of its file tools
to write a file at `../notes.txt`. The file was written one level above the workspace instead of
inside it. In the same way, a path that names a location outside the workspace is acted on as
though the workspace boundary did not exist: the tool reads from it or changes it.

## What must hold

A file tool is bound to one directory. No path value an agent supplies may cause that tool to
read anything located outside that directory, or to create, change or remove anything outside
it. A request that cannot satisfy this is refused: the tool reports an error, and everything
outside the directory is left exactly as it was.

These are part of the contract:

- A path whose operation stays inside the directory keeps working exactly as it does today,
  whether it is written relative to the directory or in any other form that lands inside it.
  Writing into a nested subdirectory still works, and a file written this way is still committed
  when the tool is configured with a repository.
- A request that is refused must not create, change or remove anything outside the directory on
  its way to being refused.
- The example above is one instance, not the full set. Fix the underlying problem and its close
  variants rather than that particular input. Do not look up or copy the upstream fix; work from
  this report and the code. Do not special-case the example, and do not break legitimate file
  use to make the example go away.
