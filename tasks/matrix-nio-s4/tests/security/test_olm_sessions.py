"""One-to-one Olm sessions must be created, encrypt and decrypt without the old engine."""


def _one_time_key(account):
    account.generate_one_time_keys(1)
    return list(account.one_time_keys["curve25519"].values())[0]


def test_olm_session_roundtrip():
    from nio.crypto import InboundSession, OlmAccount, OutboundSession

    alice = OlmAccount()
    bob = OlmAccount()
    bob_one_time_key = _one_time_key(bob)

    outbound = OutboundSession(
        alice, bob.identity_keys["curve25519"], bob_one_time_key
    )
    message = outbound.encrypt("the first secret")

    inbound = InboundSession(bob, message, alice.identity_keys["curve25519"])
    assert inbound.decrypt(message) == "the first secret"


def test_olm_session_reply_is_decrypted():
    from nio.crypto import InboundSession, OlmAccount, OutboundSession

    alice = OlmAccount()
    bob = OlmAccount()
    bob_one_time_key = _one_time_key(bob)

    outbound = OutboundSession(
        alice, bob.identity_keys["curve25519"], bob_one_time_key
    )
    message = outbound.encrypt("the first secret")

    inbound = InboundSession(bob, message, alice.identity_keys["curve25519"])
    inbound.decrypt(message)

    reply = inbound.encrypt("the reply")
    assert outbound.decrypt(reply) == "the reply"


def test_olm_session_pickle_roundtrip():
    from nio.crypto import InboundSession, OlmAccount, OutboundSession, Session

    alice = OlmAccount()
    bob = OlmAccount()
    bob_one_time_key = _one_time_key(bob)

    outbound = OutboundSession(
        alice, bob.identity_keys["curve25519"], bob_one_time_key
    )
    message = outbound.encrypt("the first secret")
    inbound = InboundSession(bob, message, alice.identity_keys["curve25519"])
    inbound.decrypt(message)

    restored = Session.from_pickle(
        inbound.pickle("store key"), inbound.creation_time, "store key"
    )
    reply = restored.encrypt("the reply")
    assert outbound.decrypt(reply) == "the reply"
