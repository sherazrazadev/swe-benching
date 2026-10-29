"""Legitimate account, session and group-session use keeps working."""

import vodozemac


def test_encryption_support_is_loaded():
    import nio.crypto as crypto

    assert crypto.ENCRYPTION_ENABLED is True
    for name in ("Olm", "OlmAccount", "Sas", "Session", "InboundGroupSession"):
        assert hasattr(crypto, name)


def test_account_signing_and_pickle_roundtrip():
    from nio.crypto import OlmAccount

    account = OlmAccount()
    signature = account.sign("a signed object")
    vodozemac.Ed25519PublicKey.from_base64(
        account.identity_keys["ed25519"]
    ).verify_signature(
        b"a signed object", vodozemac.Ed25519Signature.from_base64(signature)
    )

    restored = OlmAccount.from_pickle(account.pickle("passphrase"), "passphrase")
    assert restored.identity_keys == account.identity_keys


def test_olm_session_roundtrip():
    from nio.crypto import InboundSession, OlmAccount, OutboundSession

    alice = OlmAccount()
    bob = OlmAccount()
    bob.generate_one_time_keys(1)
    one_time_key = list(bob.one_time_keys["curve25519"].values())[0]

    outbound = OutboundSession(
        alice, bob.identity_keys["curve25519"], one_time_key
    )
    message = outbound.encrypt("hello")
    inbound = InboundSession(bob, message, alice.identity_keys["curve25519"])
    assert inbound.decrypt(message) == "hello"

    reply = inbound.encrypt("reply")
    assert outbound.decrypt(reply) == "reply"


def test_group_session_roundtrip():
    from nio.crypto import InboundGroupSession, OutboundGroupSession

    outbound = OutboundGroupSession()
    outbound.shared = True
    inbound = InboundGroupSession(outbound.session_key, "", "", "!room:example.org")

    assert inbound.decrypt(outbound.encrypt("a message"))[0] == "a message"

    exported = inbound.export_session(inbound.first_known_index)
    reimported = InboundGroupSession.import_session(
        exported, "", "", "!room:example.org"
    )
    assert reimported.decrypt(outbound.encrypt("another message"))[0] == (
        "another message"
    )
