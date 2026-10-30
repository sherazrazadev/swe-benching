"""Helpers shared by the hidden suites.

The suites drive the product through its own Flask setup and read exactly what
the server writes to its standard output and to the Python logging system.
Log records are formatted the way a plain logging handler formats them, so
escape and control characters are observed byte for byte (pytest's own log
capture is deliberately not used because it drops colour sequences).
"""

import contextlib
import io
import logging


def make_app(debug_routes=False):
  """Build a Flask app configured like a running Mesop server."""
  from flask import Flask

  from mesop.server.static_file_serving import configure_static_file_serving

  app = Flask(__name__)
  configure_static_file_serving(
    app,
    static_file_runfiles_base="unused",
    disable_gzip_cache=True,
  )
  if debug_routes:
    from mesop.server.server_debug_routes import configure_debug_routes

    configure_debug_routes(app)
  return app


@contextlib.contextmanager
def emitted_logs():
  """Collect every record that reaches the logging system, as written."""
  stream = io.StringIO()
  handler = logging.StreamHandler(stream)
  handler.setFormatter(logging.Formatter("%(message)s"))
  handler.setLevel(logging.DEBUG)
  root = logging.getLogger()
  previous_level = root.level
  root.setLevel(logging.DEBUG)
  root.addHandler(handler)
  try:
    yield stream
  finally:
    root.removeHandler(handler)
    root.setLevel(previous_level)


def written(stdout, logs):
  """Everything a terminal or a log collector would have received."""
  return stdout + "\n" + logs


def csp_report(document_uri, blocked_uri, directive, **extra):
  body = {
    "document-uri": document_uri,
    "blocked-uri": blocked_uri,
    "violated-directive": directive,
  }
  body.update(extra)
  return {"csp-report": body}


# Sequences that a terminal interprets and that the product's own diagnostic
# never contains. Kept free of the colour codes the diagnostic legitimately
# emits so that their presence can only come from the submitted value.
CSI_CLEAR = "\x1b[2J"
CSI_HOME = "\x1b[H"
CSI_HIDE_CURSOR = "\x1b[?25l"
OSC_TITLE = "\x1b]0;TAKEN-OVER\x07"
OSC_LINK = "\x1b]8;;https://marker.example\x1b\\"
DCS_SEQUENCE = "\x1bP1;2;3|dcs-marker\x1b\\"
APC_SEQUENCE = "\x1b_apc-marker\x1b\\"
PM_SEQUENCE = "\x1b^pm-marker\x1b\\"
SOS_SEQUENCE = "\x1bXsos-marker\x1b\\"
SHORT_ESCAPE = "\x1b7"

CR_SEQUENCE = "\rCR-MARKER"
LF_SEQUENCE = "\nLF-MARKER"
BS_SEQUENCE = "\x08BS-MARKER"
NUL_SEQUENCE = "\x00NUL-MARKER"
BIDI_SEQUENCE = "‮BIDI-MARKER"

ESCAPE_SEQUENCES = [
  CSI_CLEAR,
  CSI_HOME,
  CSI_HIDE_CURSOR,
  OSC_TITLE,
  OSC_LINK,
  DCS_SEQUENCE,
  APC_SEQUENCE,
  PM_SEQUENCE,
  SOS_SEQUENCE,
  SHORT_ESCAPE,
]

CONTROL_SEQUENCES = [
  CR_SEQUENCE,
  LF_SEQUENCE,
  BS_SEQUENCE,
  NUL_SEQUENCE,
  BIDI_SEQUENCE,
]
