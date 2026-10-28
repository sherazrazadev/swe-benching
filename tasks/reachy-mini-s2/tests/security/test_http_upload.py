"""Attacks on the sound upload endpoint itself."""

from __future__ import annotations

import os

from support import harness

APP = harness.full_app()
CLIENT = harness.client(APP)
UPLOAD = "/api/media/sounds/upload"


def setup_function() -> None:
    harness.fresh_sounds_dir()


def teardown_function() -> None:
    harness.fresh_sounds_dir()


def _post(name: str, data: bytes, content_type: str = "application/octet-stream"):
    return CLIENT.post(UPLOAD, files={"file": (name, data, content_type)})


def test_non_audio_under_script_name_is_refused() -> None:
    response = _post("setup.sh", harness.marker_bytes(), "text/plain")
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_audio_content_under_script_name_is_refused() -> None:
    response = _post("setup.sh", harness.wav_bytes(), "audio/wav")
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_non_audio_under_audio_name_is_refused() -> None:
    response = _post("alert.wav", harness.marker_bytes(), "audio/wav")
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_non_audio_without_extension_is_refused() -> None:
    response = _post("payload", harness.marker_bytes(), "application/octet-stream")
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_oversized_body_with_honest_length_is_refused() -> None:
    oversized = harness.large_wav_bytes(26 * 1024 * 1024)
    response = _post("big.wav", oversized, "audio/wav")
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_oversized_stream_without_length_is_refused() -> None:
    response = harness.post_streaming(
        APP, UPLOAD, "streamed.wav", 26 * 1024 * 1024
    )
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_oversized_stream_with_understated_length_is_refused() -> None:
    response = harness.post_streaming(
        APP, UPLOAD, "streamed.wav", 26 * 1024 * 1024, declared_length=1024
    )
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_refused_upload_does_not_alter_an_existing_file() -> None:
    original = harness.wav_bytes()
    os.makedirs(harness.SOUNDS_DIR, exist_ok=True)
    with open(os.path.join(harness.SOUNDS_DIR, "keep.wav"), "wb") as handle:
        handle.write(original)
    before = sorted(os.listdir(harness.SOUNDS_DIR))

    response = _post("keep.wav", harness.marker_bytes(), "audio/wav")
    harness.strong_assert_client_error(response)

    assert sorted(os.listdir(harness.SOUNDS_DIR)) == before
    assert harness.read_sound("keep.wav") == original
