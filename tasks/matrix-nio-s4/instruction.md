# Encryption must keep working without the deprecated crypto engine

matrix-nio is a Python client library for Matrix. With its encryption support installed it gives a
client end-to-end encryption: device identity keys, one-to-one encrypted sessions, encrypted room
sessions, device verification, room-key export and import, and a local store that keeps that state
across restarts.

## What we observe

We run the library on machines where the deprecated third-party cryptographic engine is no longer
present. There `import nio.crypto` still succeeds, but encryption is silently switched off: the
module exposes no encryption classes, so a client cannot encrypt, decrypt, verify a device or
recover its saved state. Applications with encrypted rooms stop working, and nothing tells them
why. On machines that still carry the deprecated engine, the library keeps an unmaintained native
library in the process instead.

One concrete trigger:

```python
import nio.crypto as crypto
assert crypto.ENCRYPTION_ENABLED   # False on a machine without the deprecated engine
```

## What must hold

The library must not depend on the deprecated engine. On any installation where that engine is
absent, every encryption operation and every cryptographic check the library offers must still run,
through the maintained engine, with the same results as today. The absence of the deprecated engine
must never disable an operation, skip a check, or make a check succeed.

Two things must be preserved. Encryption that works today keeps working exactly as today. State
saved by earlier releases keeps working, including on an upgrading install that still has the
deprecated engine around. Encrypted messages the library produces must remain exchangeable with
other Matrix clients.

If an operation truly cannot be completed it must raise an error. It must never report success,
accept invalid input, or be silently skipped. The public encryption and storage API keeps its
current names and behaviour.

## Notes

The snippet is one example, not the full set of operations or checks involved. There is no network
access. Fix the problem and its close variants; keep legitimate use working; do not look up the
upstream fix or any existing implementation; do not special-case the example.
