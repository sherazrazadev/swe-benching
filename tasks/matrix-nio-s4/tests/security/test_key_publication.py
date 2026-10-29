"""Key publication must include every key the account publishes today."""

import vodozemac

from support import helpers

USER_ID = "@alice:example.org"
DEVICE_ID = "ALICEDEVICE"


def test_one_time_and_fallback_keys_are_published():
    from nio.crypto import Olm
    from nio.store import SqliteMemoryStore

    machine = Olm(USER_ID, DEVICE_ID, SqliteMemoryStore(USER_ID, DEVICE_ID))
    payload = machine.share_keys()

    assert payload["one_time_keys"]

    fallback_keys = payload.get("fallback_keys")
    assert fallback_keys, "no fallback key was published"
    assert len(fallback_keys) == 1

    signing_key = vodozemac.Ed25519PublicKey.from_base64(
        machine.account.identity_keys["ed25519"]
    )

    for key_id, entry in fallback_keys.items():
        assert key_id.startswith("signed_curve25519:")
        vodozemac.Curve25519PublicKey.from_base64(entry["key"])

        signature = entry["signatures"][USER_ID]["ed25519:" + DEVICE_ID]
        signing_key.verify_signature(
            helpers.canonical_json({"key": entry["key"]}).encode(),
            vodozemac.Ed25519Signature.from_base64(signature),
        )
