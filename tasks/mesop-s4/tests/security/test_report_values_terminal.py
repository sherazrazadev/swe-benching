"""Values submitted in a security-policy report must not reach the console
with terminal escape or control sequences intact."""

import pytest

from terminal_probe import (
  CONTROL_SEQUENCES,
  ESCAPE_SEQUENCES,
  csp_report,
  emitted_logs,
  make_app,
)


def _post_and_read(capsys, report):
  app = make_app()
  with emitted_logs() as logs:
    response = app.test_client().post("/__csp__", json=report)
    stdout = capsys.readouterr().out
  del logs
  return response, stdout


@pytest.mark.parametrize("payload", ESCAPE_SEQUENCES)
def test_escape_sequence_in_page_and_blocked_url(capsys, payload):
  report = csp_report(
    "https://app.example/route" + payload + "/page",
    "https://blocked.example" + payload + "/asset.js",
    "connect-src",
  )
  response, output = _post_and_read(capsys, report)
  assert response.status_code < 500
  assert payload not in output


def test_two_byte_escape_alone_in_page_path(capsys):
  report = csp_report(
    "https://app.example/" + "\x1b7" + "page",
    "https://blocked.example/asset.js",
    "script-src-elem",
  )
  response, output = _post_and_read(capsys, report)
  assert response.status_code < 500
  assert "\x1b7" not in output


@pytest.mark.parametrize("payload", CONTROL_SEQUENCES)
def test_control_character_in_blocked_url(capsys, payload):
  # The blocked address is echoed verbatim, so a line break, backspace, NUL
  # or bidi override placed there must not be echoed as-is.
  report = csp_report(
    "https://app.example/page",
    "https://blocked.example/" + payload + "asset.js",
    "connect-src",
  )
  response, output = _post_and_read(capsys, report)
  assert response.status_code < 500
  assert payload not in output


@pytest.mark.parametrize("payload", ["\x08", "\x00", "‮", "\x1b[2J"])
def test_control_character_in_page_path(capsys, payload):
  report = csp_report(
    "https://app.example/" + payload + "page",
    "https://blocked.example/asset.js",
    "frame-ancestors",
  )
  response, output = _post_and_read(capsys, report)
  assert response.status_code < 500
  assert payload not in output
