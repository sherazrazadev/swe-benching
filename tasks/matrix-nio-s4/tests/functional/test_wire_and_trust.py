"""Wire exchange, trust database and key publication keep working."""

import json
import os

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


def test_group_key_sharing_over_the_wire(tmp_path):
    from nio.events import OlmEvent

    alice, bob, _alice_device, _bob_device = _machines(tmp_path)

    room_id = "!room:example.org"
    alice.create_outbound_group_session(room_id)
    _sharing_with, to_device = alice.share_group_session(room_id, [BOB_ID])

    # The payload must survive JSON serialisation, as the client sends it.
    to_device = json.loads(json.dumps(to_device))
    content = to_device["messages"][BOB_ID][BOB_DEVICE_ID]

    event = OlmEvent.from_dict(
        {"sender": ALICE_ID, "type": "m.room.encrypted", "content": content}
    )
    assert bob.decrypt_event(event) is not None

    group_session = alice.outbound_group_sessions[room_id]
    assert bob.inbound_group_store.get(
        room_id, alice.account.identity_keys["curve25519"], group_session.id
    ) is not None


def test_trust_store_persists_and_verifies(tmp_path):
    from nio.store import Ed25519Key, KeyStore

    account = vodozemac.Account()
    key_path = os.path.join(str(tmp_path), "trusted_devices")

    store = KeyStore(key_path)
    trusted = Ed25519Key(BOB_ID, BOB_DEVICE_ID, account.ed25519_key.to_base64())
    store.add(trusted)

    reloaded = KeyStore(key_path)
    restored = reloaded.get_key(BOB_ID, BOB_DEVICE_ID)
    assert restored is not None
    assert restored.key == trusted.key

    message = "a payload signed by the device"
    signature = account.sign(message.encode()).to_base64()
    assert restored.verify(message, signature)
    assert not restored.verify("a different payload", signature)


def test_key_publication_includes_every_key(tmp_path):
    from nio.store import DefaultStore

    alice, _bob, _alice_device, _bob_device = _machines(tmp_path)
    alice.account.shared = False

    payload = alice.share_keys()
    assert payload["device_keys"]
    assert payload["one_time_keys"]
    assert payload.get("fallback_keys")

    signing_key = vodozemac.Ed25519PublicKey.from_base64(
        alice.account.identity_keys["ed25519"]
    )
    for _key_id, entry in payload["fallback_keys"].items():
        signature = entry["signatures"][ALICE_ID]["ed25519:" + ALICE_DEVICE_ID]
        signing_key.verify_signature(
            helpers.canonical_json({"key": entry["key"]}).encode(),
            vodozemac.Ed25519Signature.from_base64(signature),
        )
