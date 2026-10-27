# Web file manager: a request can act past the folder it is handling

The project is a web file manager. A deployment runs a connector script that exposes one or more
storage roots over an HTTP API. The project root contains a ready-to-run sample deployment that
serves its storage folder; `php -S 127.0.0.1:8080 -t .` starts it, and its HTTP endpoint is the
sample connector.

## Observed impact

A request can make the server act on a location outside the area it is handling. In one
reproduction, an archive download whose file name was supplied by the client returned the contents
of a file kept outside the server's working area, and that file was removed when the request
finished.

## Required property

Whatever values a client sends, the server acts only inside the area the request is scoped to. A
name the client supplies selects a single entry inside the folder it is meant for, or a single
file inside the server's own working area — never a path. No request may read, return, create,
overwrite, move or remove anything outside those areas.

The fix belongs in the application's own code, not in one deployment's configuration.

## Contracts

- A request that would break the property is not carried out: it has no such effect, and it is
  reported through the API's usual error or warning. A crash or a 5xx is not a refusal.
- The HTTP API keeps its existing commands, parameters and response shapes.
- Everything that works today keeps working exactly as today. Next to a value that tries to
  escape, a legitimate one must still be accepted: a name the server itself generated for a
  working file and the client hands back; a name the client chose for a stored item, including
  names that contain dots or a backslash (an ordinary character in a name on this platform); and
  every ordinary operation on stored items and on the server's own working files.
- A legitimate case next to an escaping one must still succeed; the two do not share a fate.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working; do not disable features to make the problem go away.
- Do not look up the upstream fix.
- Do not special-case the example.
