"""Legitimate sound uploads must keep working."""

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


def _post(name: str, data: bytes, content_type: str = "audio/wav"):
    return CLIENT.post(UPLOAD, files={"file": (name, data, content_type)})


def test_wav_is_stored_and_listed() -> None:
    data = harness.wav_bytes()
    response = _post("chime.wav", data)
    assert response.status_code == 200, response.text
    assert response.json()["path"] == os.path.join(harness.SOUNDS_DIR, "chime.wav")
    assert harness.read_sound("chime.wav") == data

    listing = CLIENT.get("/api/media/sounds")
    assert listing.status_code == 200
    assert "chime.wav" in listing.json()["files"]


def test_other_decodable_containers_are_stored() -> None:
    for name in ("tone.ogg", "tone.flac", "tone.mp3"):
        data = harness.fixture_bytes(name)
        response = _post(name, data)
        assert response.status_code == 200, (name, response.text)
        assert harness.read_sound(name) == data


def test_extension_case_is_not_significant() -> None:
    data = harness.wav_bytes()
    response = _post("Chime.WAV", data)
    assert response.status_code == 200, response.text
    assert harness.read_sound("Chime.WAV") == data


def test_directory_prefix_in_the_name_is_dropped() -> None:
    data = harness.wav_bytes()
    response = _post("sounds/dance/chime.wav", data)
    assert response.status_code == 200, response.text
    assert harness.read_sound("chime.wav") == data
    assert "dance" not in harness.sounds_files()


def test_same_name_replaces_the_previous_file() -> None:
    first = harness.wav_bytes(samples=400)
    second = harness.wav_bytes(samples=1200)
    assert _post("chime.wav", first).status_code == 200
    response = _post("chime.wav", second)
    assert response.status_code == 200, response.text
    assert harness.read_sound("chime.wav") == second


def test_a_large_but_legitimate_file_is_stored() -> None:
    data = harness.large_wav_bytes(20 * 1024 * 1024)
    response = _post("long.wav", data)
    assert response.status_code == 200, response.text
    assert harness.read_sound("long.wav") == data
