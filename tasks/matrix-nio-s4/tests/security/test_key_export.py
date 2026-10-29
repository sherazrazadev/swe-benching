"""Room-key export and import must work without the deprecated engine."""

import os

ROOM_ID = "!room:example.org"
SENDER_KEY = "SENDERKEY"
SIGNING_KEY = "SIGNINGKEY"
PASSPHRASE = "a backup passphrase"


def _machine(user_id, device_id):
    from nio.crypto import Olm
    from nio.store import SqliteMemoryStore

    return Olm(user_id, device_id, SqliteMemoryStore(user_id, device_id))


def test_exported_room_keys_can_be_imported(tmp_path):
    from nio.crypto import InboundGroupSession, OutboundGroupSession

    outbound = OutboundGroupSession()
    outbound.shared = True
    outbound.encrypt("a message before the backup")

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

    ciphertext = outbound.encrypt("a message after the backup")
    plaintext, _index = imported.decrypt(ciphertext)
    assert plaintext == "a message after the backup"
