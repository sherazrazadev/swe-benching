"""Requests for a web-component asset that the server will not serve must be
refused cleanly: the refusal cannot be left to surface as an unhandled server
error, because the server's own error report repeats the requested location."""

import pytest

from terminal_probe import emitted_logs, make_app

ASSET_PREFIX = "/__web-components-module__"


def _get_and_read(capsys, path):
  app = make_app()
  with emitted_logs() as logs:
    response = app.test_client().get(path)
    stdout = capsys.readouterr().out
  del stdout
  return response, logs.getvalue()


@pytest.mark.parametrize(
  "payload",
  [
    "\x1b[2J",
    "\x1b]0;TAKEN-OVER\x07",
    "\x1b]8;;https://marker.example\x1b\\",
    "\x1bP1;2;3|dcs-marker\x1b\\",
    "\x1b7",
  ],
)
def test_escape_sequence_in_asset_location(capsys, payload):
  encoded = "".join("%{:02x}".format(byte) for byte in payload.encode("utf-8"))
  response, output = _get_and_read(
    capsys, ASSET_PREFIX + "/component" + encoded + "module"
  )
  assert 400 <= response.status_code < 500
  assert payload not in output


def test_escape_sequence_in_rejected_file_extension(capsys):
  encoded = "%1b%5b2J"
  response, output = _get_and_read(
    capsys, ASSET_PREFIX + "/component." + encoded
  )
  assert 400 <= response.status_code < 500
  assert "\x1b[2J" not in output


@pytest.mark.parametrize("payload", ["\r", "\x08", "\x00", "‮"])
def test_control_character_in_asset_location(capsys, payload):
  encoded = "".join("%{:02x}".format(byte) for byte in payload.encode("utf-8"))
  response, output = _get_and_read(
    capsys, ASSET_PREFIX + "/component" + encoded + "FAKE-ENTRY"
  )
  assert 400 <= response.status_code < 500
  assert payload + "FAKE-ENTRY" not in output
