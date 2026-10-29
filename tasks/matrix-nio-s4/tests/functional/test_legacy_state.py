"""State saved by earlier releases must keep loading on an upgrading install."""

import os
import sqlite3

from support import helpers

STORE_KEY = "STORE_KEY"


def _load_machine(tmp_path, fixture, user_id=None, device_id=None, key=None):
    from nio.crypto import Olm
    from nio.store import DefaultStore

    user_id = user_id or helpers.FIXTURE_USER
    device_id = device_id or helpers.FIXTURE_DEVICE
    key = key or helpers.FIXTURE_PICKLE_KEY
    helpers.install_store_fixture(tmp_path, fixture, user_id, device_id)
    store = DefaultStore(user_id, device_id, str(tmp_path), key)
    return Olm(user_id, device_id, store)


def test_account_saved_by_an_earlier_release_loads(tmp_path):
    machine = _load_machine(tmp_path, helpers.ACCOUNT_V4_FIXTURE)

    assert (
        machine.account.identity_keys["curve25519"]
        == "Xjuu9d2KjHLGIHpCOCHS7hONQahapiwI1MhVmlPlCFM"
    )
    assert (
        machine.account.identity_keys["ed25519"]
        == "FEfrmWlasr4tcMtbNX/BU5lbdjmpt3ptg8ApTD8YAh4"
    )

    row = _stored_row(tmp_path, helpers.FIXTURE_USER, helpers.FIXTURE_DEVICE,
                      "olmsessions", ["sender_key"])
    assert machine.session_store.get(row["sender_key"]) is not None


def test_oldest_supported_account_pickle_loads(tmp_path):
    # Pickles written before the fourth format version can only be upgraded
    # with the engine that wrote them; an upgrading install still has it.
    machine = _load_machine(tmp_path, helpers.ACCOUNT_V2_FIXTURE)

    assert (
        machine.account.identity_keys["curve25519"]
        == "Xjuu9d2KjHLGIHpCOCHS7hONQahapiwI1MhVmlPlCFM"
    )


def test_group_session_saved_by_an_earlier_release_loads(tmp_path):
    from nio.store import DefaultStore

    user_id = "@example:localhost"
    device_id = "DEVICEID"
    helpers.install_store_fixture(
        tmp_path, helpers.INBOUND_GROUP_V1_FIXTURE, user_id, device_id
    )

    row = _stored_row(
        tmp_path,
        user_id,
        device_id,
        "megolminboundsessions",
        ["sender_key", "session_id", "room_id"],
    )

    store = DefaultStore(user_id, device_id, str(tmp_path), helpers.FIXTURE_PICKLE_KEY)
    sessions = store.load_inbound_group_sessions()

    restored = sessions.get(row["room_id"], row["sender_key"], row["session_id"])
    assert restored is not None
    assert restored.id == row["session_id"]


def test_saved_state_keeps_working_after_a_reload(tmp_path):
    from nio.crypto import OlmAccount, OutboundSession, Session
    from nio.store import DefaultStore
    from nio.crypto import Olm

    bob = OlmAccount()
    bob.generate_one_time_keys(1)
    one_time_key = list(bob.one_time_keys["curve25519"].values())[0]

    alice = Olm(
        "@alice:example.org",
        "ALICEDEVICE",
        DefaultStore("@alice:example.org", "ALICEDEVICE", str(tmp_path), STORE_KEY),
    )
    session = alice.create_session(one_time_key, bob.identity_keys["curve25519"])
    session.encrypt("first")

    pickle = session.pickle(STORE_KEY)
    restored = Session.from_pickle(
        pickle, session.creation_time, STORE_KEY
    )
    assert restored.id == session.id


def _stored_row(tmp_path, user_id, device_id, table, columns):
    database = sqlite3.connect(os.path.join(str(tmp_path), f"{user_id}_{device_id}.db"))
    try:
        database.row_factory = sqlite3.Row
        row = database.execute(f"select {', '.join(columns)} from {table}").fetchone()
    finally:
        database.close()
    assert row is not None
    return dict(row)
