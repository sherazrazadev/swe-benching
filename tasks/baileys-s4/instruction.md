# Another user's control messages can drive a linked device's local state

The product is a TypeScript library that an application uses to run a WhatsApp Web linked
device. It opens a socket with the account's stored credentials, receives encrypted stanzas,
decrypts them into message objects, and applies them to local state that the application then
reads through the library's events: chat and contact data, message history, app-state
(settings) sync, identity mappings, and the store of messages the client holds.

## Impact

A message sent by another person can carry a control payload that the library applies as if it
came from one of the account's own devices. The sender can then drive operations that are
reserved for the account's own devices: make the client record, complete or report a history
sync it never asked for, install an app-state sync key, store or migrate identity mappings,
change stored account settings, or add a message to the store that the account never requested.
The victim's local state changes without the account's involvement.

## Trigger

An application creates a socket with the library's normal connection API and receives a message
from another user whose content carries such a control payload. The library's inbound path
applies it to local state even though the account itself did not send the message.

## The property

A message sent by anyone other than the account must never change state that only the account's
own devices are allowed to change. Such a message must not:

- record, advance, complete or report history synchronisation;
- store or replace app-state sync keys, or use a key to start a sync;
- store or migrate identity mappings between a contact's addresses;
- change the account's stored settings;
- add a message to the account's message store that the account did not request.

This holds however the control payload is delivered and whatever wrapping or nesting the message
content uses. It is not limited to one payload type.

## Contracts

- The observable outcome is the library's state and the events it emits for that state. When a
  message from another person is refused, the state change and the events that report it must
  not happen. A silent drop and a raised error are both acceptable refusals, provided no state
  changes.
- A message's origin is the own-device indication carried on the message. Messages marked as
  sent by the account are the account's own-device messages.
- Everything that works today keeps working exactly as today: messages, chats, contacts,
  reactions, and the control messages other users are legitimately allowed to send (deletes,
  edits, disappearing-setting changes, label changes) must keep being applied, and control
  messages from the account's own devices must keep taking effect.

## Notes

The example in the Trigger section is one instance, not the full set. Fix the problem and its
close variants; keep legitimate use working; do not look up the upstream fix; do not
special-case the example.
