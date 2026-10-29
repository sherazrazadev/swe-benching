# Volume target connection settings are returned to callers who may not see them

Ironic is a service for provisioning and managing bare-metal machines. Its REST API
exposes nodes and the storage volumes they boot from. A volume target records how a node
reaches one such volume: the storage portal, the iSCSI name it logs in to, and the CHAP
login name and password. These settings live in the target's `properties` field.

An operator can be allowed to manage a node's volume targets without being allowed to
view their connection configuration; the two rights are separate. A user holding only the
first reported that updating a volume target returned the target's connection settings in
the response, with the CHAP password in clear text.

## Required behaviour

Volume target connection configuration is sensitive. It must never be returned to a
client that has not been granted the separate permission to view that configuration, and
a password-like value in it must never be returned in clear text to any client, however
the response is produced.

The following must keep working exactly as today:

- A client that is permitted to perform an operation keeps that operation, and the values
  it supplies are stored as supplied.
- A client that has been granted the permission to view connection configuration keeps
  every ordinary, non-secret setting.
- A client that has not been granted that permission keeps using the resource normally;
  the settings are withheld from the response rather than the operation being denied.
- Values that are not connection configuration are unchanged, and other resources are
  unaffected.

## Contracts

- A response may omit the settings or replace a password-like value with a masked value;
  a request that is otherwise permitted must still succeed.
- If the settings cannot be withheld from a response, refuse with a client error (4xx).
  A server error (5xx) is not an acceptable outcome.
- A value is password-like when its key name marks it as a password or a similar secret
  (a CHAP password, for example). Other settings are not password-like.
- The examples above are examples, not the full set of ways the settings can be supplied
  or returned.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or advisory.
- Do not special-case the example values.
- There is no network access.
