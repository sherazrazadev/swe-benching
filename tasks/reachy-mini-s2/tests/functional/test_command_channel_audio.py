"""Legitimate uploads through the SDK and WebRTC command channels."""

from __future__ import annotations

import shutil

from support import harness


def setup_function() -> None:
    shutil.rmtree(harness.DEFAULT_AUDIO_ROOT, ignore_errors=True)


def teardown_function() -> None:
    shutil.rmtree(harness.DEFAULT_AUDIO_ROOT, ignore_errors=True)


def _stored_with(root: str, header: bytes, data: bytes) -> bool:
    return any(
        open(path, "rb").read() == data
        for path in harness.files_containing(root, header)
    )


def test_sdk_channel_stores_a_genuine_wav() -> None:
    data = harness.wav_bytes()
    with harness.private_temp_root() as root:
        harness.run_sdk_audio("sdk-good", data)
        assert _stored_with(root, b"RIFF", data)


def test_webrtc_channel_stores_a_genuine_wav() -> None:
    data = harness.wav_bytes()
    with harness.private_temp_root() as root:
        harness.run_webrtc_audio("rtc-good", data)
        assert _stored_with(root, b"RIFF", data)


def test_sdk_channel_stores_a_decodable_container() -> None:
    data = harness.fixture_bytes("tone.ogg")
    with harness.private_temp_root() as root:
        harness.run_sdk_audio("sdk-ogg", data)
        assert _stored_with(root, b"OggS", data)


def test_sdk_channel_replaces_audio_for_the_same_id() -> None:
    first = harness.wav_bytes(samples=400)
    second = harness.wav_bytes(samples=1200)
    with harness.private_temp_root() as root:
        harness.run_sdk_audio("same-id", first)
        harness.run_sdk_audio("same-id", second)
        assert _stored_with(root, b"RIFF", second)
        assert not _stored_with(root, b"RIFF", first)
