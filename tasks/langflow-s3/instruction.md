# MCP file access is not confined to the caller's account

Langflow is a visual builder for AI flows. A flow belongs to an account, and Langflow runs a Model
Context Protocol (MCP) server so an external MCP client can read the files a user has. Files can
belong to a flow or directly to an account, and the account's ordinary file API serves them too.

## Observed impact

Two ordinary, non-admin accounts exist. Account B connects an MCP client to the server and asks it
to read a resource URI whose first path segment is one of account A's flow identifiers and whose
second segment is a file name that account A stored in that flow. The call returns account A's file
contents. The ordinary HTTP download of the same file is refused.

## Required behaviour

**Access.** No response the server returns may expose file content, file names, or flow or project
identifiers that belong to an account other than the caller's. Where a request is scoped to part of
the caller's own material, only that part may be returned.

**Containment.** No identifier or file name passed in may make the product reach, create, or change
a stored file outside the container that identifier names; anything read must come from inside it.

## Contracts

- A refusal is a client error that returns no file content and changes no stored file. Any error
  status or protocol error is acceptable; no particular status is required.
- Resource URIs keep their current download shape.
- Everything that works today keeps working. A caller keeps using its own material exactly as
  today, including files that belong directly to the account rather than to a flow, and names with
  spaces or non-ASCII characters.
- The example above is one example, not the full set of affected inputs or callers. Fix the problem
  and its close variants; keep legitimate use working. Do not look up an upstream fix. Do not
  special-case the example.
