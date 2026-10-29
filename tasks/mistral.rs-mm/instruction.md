# mistral.rs server: request media sources can reach the server's own files and network

mistral.rs is an inference server that answers chat, responses and messages requests over HTTP. A
request may carry image, audio, video, or file-attachment content; the server loads the named content
on the request's behalf before generating a response.

## Observed impact

A chat-completions request whose image content names a `file:` URL for a path on the server machine is
accepted, and the bytes at that path are used as the image.

## Security invariant

No value supplied in a request may make the server read data from its own filesystem, or make the
server connect to or fetch from an address that is not publicly routable: not the machine it runs on,
not its loopback interface, and not a private, link-local or otherwise internal network. This holds
for every request content that names a resource for the server to load, whatever field or form carries
the name.

## Contracts

- Refusal: a request that would break the invariant is refused with a client error and has no effect;
  nothing it names is read, fetched, or used before the refusal.
- Inline content the request already carries — for example base64-encoded or `data:` content — keeps
  working.
- Publicly routable `http` and `https` sources keep working.
- Trusted in-process callers that load media from local paths or `file:` URLs — the CLI, for example —
  keep working exactly as today.
- Everything else that works today keeps working exactly as today.
- There is no network access.

## Constraints

Fix the problem and its close variants. Do not look up the upstream fix or an existing implementation.
Do not special-case the example; a general rule is expected for every request content named above.
