"""Attacks through the SDK and WebRTC command channels."""

from __future__ import annotations

import shutil

from support import harness

MARKER = harness.marker_bytes()
_TOO_BIG = 26 * 1024 * 1024


def setup_function() -> None:
    shutil.rmtree(harness.DEFAULT_AUDIO_ROOT, ignore_errors=True)


def teardown_function() -> None:
    shutil.rmtree(harness.DEFAULT_AUDIO_ROOT, ignore_errors=True)


def test_sdk_channel_refuses_non_audio_payload() -> None:
    with harness.private_temp_root() as root:
        harness.run_sdk_audio("sdk-bad", MARKER)
        assert harness.stored_anywhere([root], MARKER) == []


def test_webrtc_channel_refuses_non_audio_payload() -> None:
    with harness.private_temp_root() as root:
        harness.run_webrtc_audio("rtc-bad", MARKER)
        assert harness.stored_anywhere([root], MARKER) == []


def test_sdk_channel_refuses_oversized_payload() -> None:
    with harness.private_temp_root() as root:
        harness.run_sdk_audio("sdk-big", b"\x00" * _TOO_BIG)
        assert harness.all_stored_anywhere([root]) == []


def test_webrtc_channel_refuses_oversized_payload() -> None:
    with harness.private_temp_root() as root:
        harness.run_webrtc_audio("rtc-big", b"\x00" * _TOO_BIG)
        assert harness.all_stored_anywhere([root]) == []


def test_refused_reupload_keeps_the_previous_audio() -> None:
    good = harness.wav_bytes()
    with harness.private_temp_root() as root:
        harness.run_sdk_audio("same-id", good)
        stored = harness.files_containing(root, b"RIFF")
        assert stored, "the genuine upload was not stored"

        harness.run_sdk_audio("same-id", MARKER)

        assert harness.stored_anywhere([root], MARKER) == []
        stored_now = harness.files_containing(root, b"RIFF")
        assert stored_now, "the refused upload removed the previous audio"
        assert any(
            open(path, "rb").read() == good for path in stored_now
        ), "the refused upload altered the previous audio"
