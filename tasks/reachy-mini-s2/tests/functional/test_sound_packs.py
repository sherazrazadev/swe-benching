"""Legitimate sound-pack imports must keep working."""

from __future__ import annotations

from support import harness

APP = harness.full_app()
CLIENT = harness.client(APP)
IMPORT = "/api/media/sounds/packs/import"
BULK = "/api/media/sounds/packs/bulk"


def setup_function() -> None:
    harness.fresh_sounds_dir()


def teardown_function() -> None:
    harness.fresh_sounds_dir()


def test_archive_imports_every_genuine_sound() -> None:
    wav = harness.wav_bytes()
    ogg = harness.fixture_bytes("tone.ogg")
    response = CLIENT.post(
        IMPORT,
        files={
            "file": (
                "pack.zip",
                harness.zip_bytes([("chime.wav", wav), ("tone.ogg", ogg)]),
                "application/zip",
            )
        },
    )
    assert response.status_code == 200, response.text
    assert harness.read_sound("chime.wav") == wav
    assert harness.read_sound("tone.ogg") == ogg


def test_bulk_upload_stores_every_genuine_sound() -> None:
    wav = harness.wav_bytes()
    flac = harness.fixture_bytes("tone.flac")
    response = CLIENT.post(
        BULK,
        files=[
            ("files", ("chime.wav", wav, "audio/wav")),
            ("files", ("tone.flac", flac, "audio/flac")),
        ],
    )
    assert response.status_code == 200, response.text
    assert harness.read_sound("chime.wav") == wav
    assert harness.read_sound("tone.flac") == flac


def test_archive_replaces_a_file_with_the_same_name() -> None:
    original = harness.wav_bytes(samples=400)
    replacement = harness.wav_bytes(samples=1200)
    first = CLIENT.post(
        IMPORT,
        files={
            "file": (
                "pack.zip",
                harness.zip_bytes([("chime.wav", original)]),
                "application/zip",
            )
        },
    )
    assert first.status_code == 200, first.text

    second = CLIENT.post(
        IMPORT,
        files={
            "file": (
                "pack.zip",
                harness.zip_bytes([("chime.wav", replacement)]),
                "application/zip",
            )
        },
    )
    assert second.status_code == 200, second.text
    assert harness.read_sound("chime.wav") == replacement
