# A request that declares a body can be lost when the connection switches protocols

## The product

aiohttp is an asynchronous HTTP client and server library for Python. An application builds a web
server from it: the library receives bytes from the network, decides when a request has been fully
received, and passes the request to an application function, which may read the request body (for
example with `await request.read()`). aiohttp also supports protocol switches: a client may ask to
change the protocol on a connection (WebSocket is the common case), and the application may accept
the switch or keep speaking HTTP.

## What can go wrong

A server built on aiohttp can lose a request body that the client declared and treat those bytes as
part of another protocol or as a separate message. A server with this application function:

```python
async def handler(request):
    body = await request.read()
    return web.Response(text=f"received {len(body)} bytes")
```

can receive this request:

```
GET /chat HTTP/1.1
Host: example.test
Connection: Upgrade
Upgrade: websocket
Content-Length: 34

<34 bytes the client declared as the request body>
```

The function runs and answers normally, but the body it reads is empty, while the 34 bytes are
treated by the server as data belonging to the connection after the switch or as another request.
A client that declared a body can therefore make those bytes act on the server as a message the
application never received: a message-framing desync of the kind used for request smuggling.

## The property that must hold

Whenever a request declares a body, by any framing the protocol allows, an application that reads
the request body receives every declared byte, no byte of that body may be interpreted as a
separate HTTP message, and no byte of that body may be treated as data of a protocol the connection
switches to. This holds for every supported protocol switch and in every way the library can be
built or configured.

## Contracts

- **Refusal.** If a request cannot be parsed or framed safely, the server may reject it with a
  client error or close the connection; either way none of its body bytes may act as a message or
  as data of another protocol.
- **Delivery.** A body of any declared length, including zero and any framing the protocol allows,
  follows the rule above, however the bytes are split into packets.
- **Continuation.** Once a declared body has been consumed, the connection keeps working: a request
  that follows it on the same connection is still handled.
- **Preservation.** Everything that works today keeps working exactly as today. A request that asks
  for a protocol switch without declaring a body still switches immediately and the bytes after its
  header block still belong to the new protocol; a request that asks for an upgrade the server does
  not support is still an ordinary request whose body can be read; a tunnel request keeps its raw
  payload.

The example above is one instance, not the full set of ways the property can be violated.

## Constraints

- Fix the flaw and its close variants, not just the example shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
