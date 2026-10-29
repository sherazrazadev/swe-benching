"""Signature checks must still be enforced without the deprecated engine."""

import vodozemac

from support import helpers

USER_ID = "@bob:example.org"
DEVICE_ID = "BOBDEVICE"


def test_signed_device_object_is_verified():
    from nio.crypto import Olm
    from nio.store import SqliteMemoryStore

    machine = Olm(
        "@alice:example.org",
        "ALICEDEVICE",
        SqliteMemoryStore("@alice:example.org", "ALICEDEVICE"),
    )

    account = vodozemac.Account()
    device_object = {
        "user_id": USER_ID,
        "device_id": DEVICE_ID,
        "keys": {"curve25519:" + DEVICE_ID: account.curve25519_key.to_base64()},
    }
    signature = account.sign(helpers.canonical_json(device_object).encode())
    signed = dict(device_object)
    signed["signatures"] = {USER_ID: {"ed25519:" + DEVICE_ID: signature.to_base64()}}

    assert machine.verify_json(
        dict(signed),
        account.ed25519_key.to_base64(),
        USER_ID,
        DEVICE_ID,
    )

    tampered = dict(device_object)
    tampered["device_id"] = "SOMEONEELSE"
    tampered["signatures"] = signed["signatures"]

    assert not machine.verify_json(
        dict(tampered),
        account.ed25519_key.to_base64(),
        USER_ID,
        DEVICE_ID,
    )


def test_trusted_device_key_verifies_messages():
    from nio.store import Ed25519Key

    account = vodozemac.Account()
    trusted = Ed25519Key(USER_ID, DEVICE_ID, account.ed25519_key.to_base64())

    message = "a payload signed by the device"
    signature = account.sign(message.encode()).to_base64()

    assert trusted.verify(message, signature)
    assert not trusted.verify("a different payload", signature)
    assert not trusted.verify(message, "AAAA")


def test_trusted_device_key_rejects_another_signers_message():
    from nio.store import Ed25519Key

    trusted_account = vodozemac.Account()
    other_account = vodozemac.Account()

    trusted = Ed25519Key(USER_ID, DEVICE_ID, trusted_account.ed25519_key.to_base64())
    message = "a payload signed by the device"
    signature = other_account.sign(message.encode()).to_base64()

    assert not trusted.verify(message, signature)
