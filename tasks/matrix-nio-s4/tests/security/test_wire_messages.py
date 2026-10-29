"""Encrypted to-device messages must stay usable on the JSON wire."""

import json

import vodozemac

from support import helpers

ALICE_ID = "@alice:example.org"
ALICE_DEVICE_ID = "ALICEDEVICE"
BOB_ID = "@bob:example.org"
BOB_DEVICE_ID = "BOBDEVICE"


def _machines(tmp_path):
    from nio.crypto import Olm, OlmDevice
    from nio.store import DefaultStore

    alice = Olm(
        ALICE_ID,
        ALICE_DEVICE_ID,
        DefaultStore(ALICE_ID, ALICE_DEVICE_ID, str(tmp_path)),
    )
    bob = Olm(
        BOB_ID, BOB_DEVICE_ID, DefaultStore(BOB_ID, BOB_DEVICE_ID, str(tmp_path))
    )

    bob.account.generate_one_time_keys(1)
    bob_one_time_key = list(bob.account.one_time_keys["curve25519"].values())[0]
    bob.account.mark_keys_as_published()

    alice_device = OlmDevice(ALICE_ID, ALICE_DEVICE_ID, alice.account.identity_keys)
    bob_device = OlmDevice(BOB_ID, BOB_DEVICE_ID, bob.account.identity_keys)

    alice.device_store.add(bob_device)
    bob.device_store.add(alice_device)
    alice.verify_device(bob_device)

    alice.create_session(bob_one_time_key, bob_device.curve25519)

    return alice, bob, alice_device, bob_device


def _share(machine, room_id):
    machine.create_outbound_group_session(room_id)
    _sharing_with, to_device = machine.share_group_session(room_id, [BOB_ID])
    return to_device["messages"][BOB_ID][BOB_DEVICE_ID]


def _decrypt(machine, sender_id, content):
    from nio.events import OlmEvent

    event = OlmEvent.from_dict(
        {"sender": sender_id, "type": "m.room.encrypted", "content": content}
    )
    return machine.decrypt_event(event)


def _message_from_wire(message):
    if message["type"] == 0:
        return vodozemac.PreKeyMessage.from_base64(message["body"])
    return vodozemac.AnyOlmMessage.normal(
        helpers.unpadded_b64decode(message["body"])
    )


def test_ciphertext_body_is_text_on_the_wire(tmp_path):
    alice, _bob, _alice_device, _bob_device = _machines(tmp_path)

    content = _share(alice, "!room:example.org")

    # The to-device payload is serialised to JSON; byte strings cannot be.
    json.dumps(content)

    ciphertext = content["ciphertext"]
    assert len(ciphertext) == 1
    for _curve_key, message in ciphertext.items():
        assert message["type"] in (0, 1)
        assert isinstance(message["body"], str)
        assert helpers.unpadded_b64decode(message["body"])
        # The wire body must parse with the maintained engine.
        _message_from_wire(message)


def test_prekey_and_normal_messages_decrypt(tmp_path):
    alice, bob, alice_device, bob_device = _machines(tmp_path)

    first_content = _share(alice, "!room:example.org")
    first_message = list(first_content["ciphertext"].values())[0]
    assert first_message["type"] == 0
    assert _decrypt(bob, ALICE_ID, first_content) is not None

    # Bob answers on the session he just created, which establishes it on
    # Alice's side; her session then sends normal (non pre-key) messages.
    bob_session = bob.session_store.get(alice_device.curve25519)
    assert bob_session is not None
    reply = bob_session.encrypt(json.dumps({"type": "m.dummy", "content": {}}))
    reply_type, reply_ciphertext = reply.to_parts()
    alice.decrypt(
        BOB_ID,
        bob_device.curve25519,
        _message_from_wire(
            {"type": reply_type, "body": helpers.unpadded_b64encode(reply_ciphertext)}
        ),
    )

    second_content = _share(alice, "!other:example.org")
    second_message = list(second_content["ciphertext"].values())[0]
    assert second_message["type"] == 1
    assert _decrypt(bob, ALICE_ID, second_content) is not None
