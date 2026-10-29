"""Device verification and room-key backup keep working."""

import os

import vodozemac

ROOM_ID = "!room:example.org"
SENDER_KEY = "SENDERKEY"
SIGNING_KEY = "SIGNINGKEY"
PASSPHRASE = "a backup passphrase"


def _device(user_id, device_id, account):
    from nio.crypto import OlmDevice

    return OlmDevice(
        user_id,
        device_id,
        {
            "ed25519": account.ed25519_key.to_base64(),
            "curve25519": account.curve25519_key.to_base64(),
        },
    )


def test_sas_handshake_verifies_both_devices():
    from nio.crypto import Sas, SasState
    from nio.events import (
        KeyVerificationAccept,
        KeyVerificationKey,
        KeyVerificationMac,
        KeyVerificationStart,
    )

    alice_id, alice_device_id = "@alice:example.org", "ALICEDEVICE"
    bob_id, bob_device_id = "@bob:example.org", "BOBDEVICE"

    alice_account = vodozemac.Account()
    bob_account = vodozemac.Account()
    alice_device = _device(alice_id, alice_device_id, alice_account)
    bob_device = _device(bob_id, bob_device_id, bob_account)

    alice = Sas(alice_id, alice_device_id, alice_device.ed25519, bob_device)
    start_event = KeyVerificationStart.from_dict(
        {"sender": alice_id, "content": alice.start_verification().content}
    )
    bob = Sas.from_key_verification_start(
        bob_id, bob_device_id, bob_device.ed25519, alice_device, start_event
    )

    alice.receive_accept_event(
        KeyVerificationAccept.from_dict(
            {"sender": bob_id, "content": bob.accept_verification().content}
        )
    )

    bob.receive_key_event(
        KeyVerificationKey.from_dict(
            {"sender": alice_id, "content": alice.share_key().content}
        )
    )
    alice.receive_key_event(
        KeyVerificationKey.from_dict(
            {"sender": bob_id, "content": bob.share_key().content}
        )
    )

    assert alice.state == SasState.key_received
    alice.accept_sas()
    bob.accept_sas()

    alice_mac = {"sender": alice_id, "content": alice.get_mac().content}
    bob_mac = {"sender": bob_id, "content": bob.get_mac().content}

    bob.receive_mac_event(KeyVerificationMac.from_dict(alice_mac))
    alice.receive_mac_event(KeyVerificationMac.from_dict(bob_mac))

    assert alice.verified and bob.verified
    assert alice.get_emoji() == bob.get_emoji()


def _machine(user_id, device_id):
    from nio.crypto import Olm
    from nio.store import SqliteMemoryStore

    return Olm(user_id, device_id, SqliteMemoryStore(user_id, device_id))


def test_room_keys_can_be_exported_and_imported(tmp_path):
    from nio.crypto import InboundGroupSession, OutboundGroupSession

    outbound = OutboundGroupSession()
    outbound.shared = True
    inbound = InboundGroupSession(outbound.session_key, SIGNING_KEY, SENDER_KEY, ROOM_ID)

    alice = _machine("@alice:example.org", "ALICEDEVICE")
    alice.inbound_group_store.add(inbound)
    alice.save_inbound_group_session(inbound)

    export_file = os.path.join(str(tmp_path), "room-keys.txt")
    alice.export_keys(export_file, PASSPHRASE)

    bob = _machine("@bob:example.org", "BOBDEVICE")
    bob.import_keys(export_file, PASSPHRASE)

    imported = bob.inbound_group_store.get(ROOM_ID, SENDER_KEY, inbound.id)
    assert imported is not None
    assert imported.decrypt(outbound.encrypt("after the backup"))[0] == (
        "after the backup"
    )
