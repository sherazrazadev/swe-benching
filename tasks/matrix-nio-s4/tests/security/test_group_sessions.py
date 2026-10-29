"""Megolm group sessions must work on the maintained engine."""


def test_group_session_roundtrip():
    from nio.crypto import InboundGroupSession, OutboundGroupSession

    outbound = OutboundGroupSession()
    outbound.shared = True

    inbound = InboundGroupSession(outbound.session_key, "", "", "!room:example.org")

    ciphertext = outbound.encrypt("a room message")
    plaintext, message_index = inbound.decrypt(ciphertext)

    assert plaintext == "a room message"
    assert message_index == 0


def test_group_session_export_import():
    from nio.crypto import InboundGroupSession, OutboundGroupSession

    outbound = OutboundGroupSession()
    outbound.shared = True

    inbound = InboundGroupSession(outbound.session_key, "", "", "!room:example.org")
    exported_key = inbound.export_session(inbound.first_known_index)

    reimported = InboundGroupSession.import_session(
        exported_key, "", "", "!room:example.org"
    )

    ciphertext = outbound.encrypt("second")
    assert reimported.decrypt(ciphertext)[0] == "second"
