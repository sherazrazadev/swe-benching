"""Attacks on the sound-pack endpoints."""

from __future__ import annotations

import os

from support import harness

APP = harness.full_app()
CLIENT = harness.client(APP)
IMPORT = "/api/media/sounds/packs/import"
BULK = "/api/media/sounds/packs/bulk"


def setup_function() -> None:
    harness.fresh_sounds_dir()


def teardown_function() -> None:
    harness.fresh_sounds_dir()


def _import(members: list[tuple[str, bytes]]):
    return CLIENT.post(
        IMPORT,
        files={"file": ("pack.zip", harness.zip_bytes(members), "application/zip")},
    )


def test_archive_member_with_dangerous_type_is_refused() -> None:
    response = _import([("setup.sh", harness.marker_bytes())])
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_archive_member_with_audio_content_under_dangerous_type_is_refused() -> None:
    response = _import([("setup.sh", harness.wav_bytes())])
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_archive_member_with_non_audio_content_is_refused() -> None:
    response = _import([("alert.wav", harness.marker_bytes())])
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_archive_with_one_bad_member_stores_nothing() -> None:
    response = _import(
        [("first.wav", harness.wav_bytes()), ("second.sh", harness.marker_bytes())]
    )
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_archive_with_one_bad_member_keeps_an_existing_file() -> None:
    original = harness.wav_bytes()
    os.makedirs(harness.SOUNDS_DIR, exist_ok=True)
    with open(os.path.join(harness.SOUNDS_DIR, "first.wav"), "wb") as handle:
        handle.write(original)

    response = _import(
        [("first.wav", harness.wav_bytes()), ("second.sh", harness.marker_bytes())]
    )
    harness.strong_assert_client_error(response)
    assert harness.read_sound("first.wav") == original


def test_bulk_upload_with_one_bad_file_stores_nothing() -> None:
    response = CLIENT.post(
        BULK,
        files=[
            ("files", ("first.wav", harness.wav_bytes(), "audio/wav")),
            ("files", ("second.sh", harness.marker_bytes(), "text/plain")),
        ],
    )
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_bulk_upload_with_audio_content_under_dangerous_type_is_refused() -> None:
    response = CLIENT.post(
        BULK,
        files=[("files", ("second.sh", harness.wav_bytes(), "audio/wav"))],
    )
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []


def test_bulk_upload_with_non_audio_content_is_refused() -> None:
    response = CLIENT.post(
        BULK,
        files=[("files", ("second.wav", harness.marker_bytes(), "audio/wav"))],
    )
    harness.strong_assert_client_error(response)
    assert harness.sounds_files() == []
