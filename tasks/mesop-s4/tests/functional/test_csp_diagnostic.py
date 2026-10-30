"""A legitimate security-policy report keeps producing the same human-facing
diagnostic, with its colour, layout and suggested policy intact."""

import pytest

from terminal_probe import csp_report, emitted_logs, make_app

LEGIT = csp_report(
  "https://app.example/products?sort=price",
  "https://cdn.example.com/lib/chart.js",
  "script-src-elem",
)


def _post(capsys, report):
  app = make_app()
  with emitted_logs():
    response = app.test_client().post("/__csp__", json=report)
    stdout = capsys.readouterr().out
  return response, stdout


def test_accepted_report_still_prints_the_diagnostic(capsys):
  response, stdout = _post(capsys, LEGIT)
  assert response.status_code == 204
  assert "Content Security Policy" in stdout
  assert "script-src-elem" in stdout
  assert "https://cdn.example.com/lib/chart.js" in stdout
  assert "/products" in stdout
  assert "https://cdn.example.com" in stdout


def test_diagnostic_keeps_its_colour_and_layout(capsys):
  response, stdout = _post(capsys, LEGIT)
  assert response.status_code == 204
  # The diagnostic's own ANSI colours, symbols and multi-line layout.
  assert "\x1b[31m" in stdout
  assert "\x1b[33m" in stdout
  assert "\x1b[36m" in stdout
  assert "\x1b[0m" in stdout
  assert "⚠" in stdout
  assert "━" in stdout
  assert stdout.count("\n") >= 10
  # It is not a repr-escaped rendering of the banner.
  assert "\\n" not in stdout


@pytest.mark.parametrize(
  "directive,origin",
  [
    ("script-src-elem", "https://cdn.example.com"),
    ("connect-src", "https://api.example.net"),
    ("frame-ancestors", "https://parent.example.org"),
  ],
)
def test_suggested_policy_shows_the_plain_origin(capsys, directive, origin):
  report = csp_report(
    "https://app.example/page",
    origin + "/some/path.js",
    directive,
  )
  response, stdout = _post(capsys, report)
  assert response.status_code == 204
  assert origin in stdout


def test_warning_keeps_its_own_marker(capsys):
  # A report about a document that is not served over http(s) is refused with a
  # warning; the warning keeps the project's own styling.
  report = csp_report(
    "mailto:someone@example.com",
    "https://cdn.example.com/lib.js",
    "connect-src",
  )
  app = make_app()
  with emitted_logs() as logs:
    response = app.test_client().post("/__csp__", json=report)
    capsys.readouterr()
  assert 400 <= response.status_code < 500
  assert "\x1b[93m[warning]\x1b[0m" in logs.getvalue()


def test_non_ascii_page_values_are_preserved(capsys):
  report = csp_report(
    "https://app.example/café/page",
    "https://cdn.example.com/lib.js",
    "connect-src",
  )
  response, stdout = _post(capsys, report)
  assert response.status_code == 204
  assert "café" in stdout


def test_valid_web_component_asset_is_still_served(monkeypatch, tmp_path):
  import mesop.server.static_file_serving as serving

  (tmp_path / "widget.js").write_text("export const answer = 42;")
  monkeypatch.setattr(serving, "has_runfiles", lambda: False)
  monkeypatch.setattr(serving, "get_app_base_path", lambda: str(tmp_path))

  app = make_app()
  response = app.test_client().get(
    "/__web-components-module__/widget.js"
  )
  assert response.status_code == 200
  assert response.headers["Content-Encoding"] == "gzip"
  import gzip

  assert b"answer = 42" in gzip.decompress(response.data)
