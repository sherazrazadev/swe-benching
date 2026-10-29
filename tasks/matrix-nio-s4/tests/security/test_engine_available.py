"""The encryption support itself must load and be exported without the old engine."""


PUBLIC_CRYPTO_NAMES = [
    "Olm",
    "OlmAccount",
    "Session",
    "InboundSession",
    "OutboundSession",
    "InboundGroupSession",
    "OutboundGroupSession",
    "Sas",
    "SasState",
]


def test_encryption_support_loads():
    import nio.crypto as crypto

    assert crypto.ENCRYPTION_ENABLED is True


def test_encryption_classes_are_exported():
    import nio.crypto as crypto

    missing = [name for name in PUBLIC_CRYPTO_NAMES if not hasattr(crypto, name)]
    assert not missing, f"encryption API is incomplete: {missing}"
