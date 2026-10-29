"""Saved encryption state must be written and restored on the maintained engine."""

import os
import sqlite3

import vodozemac

from support import helpers

STORE_KEY = "STORE_KEY"


def test_saved_account_and_session_survive_a_reload(tmp_path):
    from nio.crypto import InboundSession, Olm, OlmAccount, OlmDevice
    from nio.store import DefaultStore

    bob = OlmAccount()
    bob.generate_one_time_keys(1)
    bob_one_time_key = list(bob.one_time_keys["curve25519"].values())[0]
    bob_device = OlmDevice("@bob:example.org", "BOBDEVICE", bob.identity_keys)

    alice = Olm(
        "@alice:example.org",
        "ALICEDEVICE",
        DefaultStore("@alice:example.org", "ALICEDEVICE", str(tmp_path), STORE_KEY),
    )
    alice.device_store.add(bob_device)
    session = alice.create_session(bob_one_time_key, bob_device.curve25519)

    first_message = session.encrypt("before the reload")
    bob_inbound = InboundSession(
        bob, first_message, alice.account.identity_keys["curve25519"]
    )
    assert bob_inbound.decrypt(first_message) == "before the reload"

    # The library persists a session after it encrypted with it.
    alice.save_session(bob_device.curve25519, session)
    identity = alice.account.identity_keys

    reloaded = Olm(
        "@alice:example.org",
        "ALICEDEVICE",
        DefaultStore("@alice:example.org", "ALICEDEVICE", str(tmp_path), STORE_KEY),
    )

    assert reloaded.account.identity_keys == identity
    restored_session = reloaded.session_store.get(bob_device.curve25519)
    assert restored_session is not None

    after_reload = restored_session.encrypt("after the reload")
    assert bob_inbound.decrypt(after_reload) == "after the reload"


def test_state_saved_by_an_earlier_version_loads(tmp_path):
    from nio.crypto import Olm
    from nio.store import DefaultStore

    helpers.install_store_fixture(tmp_path, helpers.ACCOUNT_V4_FIXTURE)

    row = _stored_row(
        tmp_path,
        "olmsessions",
        ["session", "sender_key", "session_id"],
        helpers.FIXTURE_USER,
        helpers.FIXTURE_DEVICE,
    )
    expected_session_id = vodozemac.Session.from_libolm_pickle(
        _as_text(row["session"]), helpers.FIXTURE_PICKLE_KEY.encode()
    ).session_id
    assert expected_session_id == row["session_id"]

    machine = Olm(
        helpers.FIXTURE_USER,
        helpers.FIXTURE_DEVICE,
        DefaultStore(
            helpers.FIXTURE_USER,
            helpers.FIXTURE_DEVICE,
            str(tmp_path),
            helpers.FIXTURE_PICKLE_KEY,
        ),
    )

    assert (
        machine.account.identity_keys["curve25519"]
        == "Xjuu9d2KjHLGIHpCOCHS7hONQahapiwI1MhVmlPlCFM"
    )
    assert (
        machine.account.identity_keys["ed25519"]
        == "FEfrmWlasr4tcMtbNX/BU5lbdjmpt3ptg8ApTD8YAh4"
    )

    restored_session = machine.session_store.get(row["sender_key"])
    assert restored_session is not None
    assert restored_session.id == expected_session_id
    assert restored_session.pickle("")


def test_saved_group_session_loads(tmp_path):
    from nio.store import DefaultStore

    user_id = "@example:localhost"
    device_id = "DEVICEID"
    helpers.install_store_fixture(
        tmp_path, helpers.INBOUND_GROUP_V1_FIXTURE, user_id, device_id
    )

    row = _stored_row(
        tmp_path,
        "megolminboundsessions",
        ["session", "sender_key", "session_id", "room_id"],
        user_id,
        device_id,
    )
    expected_session_id = vodozemac.InboundGroupSession.from_libolm_pickle(
        _as_text(row["session"]), helpers.FIXTURE_PICKLE_KEY.encode()
    ).session_id
    assert expected_session_id == row["session_id"]

    store = DefaultStore(user_id, device_id, str(tmp_path), helpers.FIXTURE_PICKLE_KEY)
    group_sessions = store.load_inbound_group_sessions()

    restored = group_sessions.get(row["room_id"], row["sender_key"], row["session_id"])
    assert restored is not None
    assert restored.id == expected_session_id
    assert restored.room_id == row["room_id"]
    assert restored.sender_key == row["sender_key"]

    # A restored group session must still be usable for decrypting.
    assert isinstance(restored.export_session(restored.first_known_index), str)


def _as_text(value):
    return value.decode() if isinstance(value, bytes) else value


def _stored_row(tmp_path, table, columns, user_id, device_id):
    database = sqlite3.connect(os.path.join(str(tmp_path), f"{user_id}_{device_id}.db"))
    try:
        database.row_factory = sqlite3.Row
        row = database.execute(f"select {', '.join(columns)} from {table}").fetchone()
    finally:
        database.close()
    assert row is not None
    return dict(row)
