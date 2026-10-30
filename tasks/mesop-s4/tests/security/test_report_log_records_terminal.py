"""The server also writes one-line records about a report to its log. Those
records must not carry the submitted values with terminal sequences intact."""

import pytest

from terminal_probe import csp_report, emitted_logs, make_app

FIELDS = [
  ("\x1b[2J", "\x1b[2J"),
  ("\rFAKE-ENTRY", "\rFAKE-ENTRY"),
  ("\nFAKE-ENTRY", "\nFAKE-ENTRY"),
  ("\x1b]0;TAKEN-OVER\x07", "\x1b]0;TAKEN-OVER\x07"),
]


@pytest.mark.parametrize("payload,needle", FIELDS)
def test_report_summary_record(capsys, payload, needle):
  report = csp_report(
    "https://app.example/route" + payload + "-page",
    "https://blocked.example/asset.js",
    "connect-src",
  )
  app = make_app()
  with emitted_logs() as logs:
    response = app.test_client().post("/__csp__", json=report)
    stdout = capsys.readouterr().out
  assert response.status_code < 500
  del stdout
  assert needle not in logs.getvalue()


@pytest.mark.parametrize("payload", ["\x1b[2J", "\x1b]0;TAKEN-OVER\x07", "\rFAKE"])
def test_violation_tracker_record(capsys, payload):
  # The tracker records the directive that was violated.
  report = csp_report(
    "https://app.example/page",
    "https://blocked.example/asset.js",
    "connect-src" + payload,
  )
  app = make_app()
  with emitted_logs() as logs:
    response = app.test_client().post("/__csp__", json=report)
    stdout = capsys.readouterr().out
  assert response.status_code < 500
  del stdout
  assert payload not in logs.getvalue()


@pytest.mark.parametrize("payload", ["\x1b[2J", "\x1b]0;TAKEN-OVER\x07"])
def test_rejected_document_warning(capsys, payload):
  # A report about a document that is not served over http(s) is refused and
  # the server warns about it.
  report = csp_report(
    "mailto:" + payload + "someone@example.com",
    "https://blocked.example/asset.js",
    "connect-src",
  )
  app = make_app()
  with emitted_logs() as logs:
    response = app.test_client().post("/__csp__", json=report)
    stdout = capsys.readouterr().out
  assert 400 <= response.status_code < 500
  del stdout
  assert payload not in logs.getvalue()
