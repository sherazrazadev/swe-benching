"""Account key material, signing and pickling must run on the maintained engine."""

import vodozemac


def test_account_identity_and_signing():
    from nio.crypto import OlmAccount

    account = OlmAccount()
    keys = account.identity_keys

    # The exported fingerprints must be valid, usable Ed25519/Curve25519 keys.
    signing_key = vodozemac.Ed25519PublicKey.from_base64(keys["ed25519"])
    vodozemac.Curve25519PublicKey.from_base64(keys["curve25519"])

    signature = account.sign("a signed device key")
    signing_key.verify_signature(
        b"a signed device key", vodozemac.Ed25519Signature.from_base64(signature)
    )


def test_account_one_time_keys_and_pickle_roundtrip():
    from nio.crypto import OlmAccount

    account = OlmAccount()
    account.generate_one_time_keys(3)

    one_time_keys = account.one_time_keys["curve25519"]
    assert len(one_time_keys) == 3
    for key_id, key in one_time_keys.items():
        assert isinstance(key_id, str)
        vodozemac.Curve25519PublicKey.from_base64(key)

    pickle = account.pickle("a store passphrase")
    restored = OlmAccount.from_pickle(pickle, "a store passphrase")
    assert restored.identity_keys == account.identity_keys

    # A restored account must still sign for the same identity.
    signature = restored.sign("a signed device key")
    vodozemac.Ed25519PublicKey.from_base64(
        restored.identity_keys["ed25519"]
    ).verify_signature(
        b"a signed device key", vodozemac.Ed25519Signature.from_base64(signature)
    )
