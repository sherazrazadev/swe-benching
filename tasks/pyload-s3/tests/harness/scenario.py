"""Drive the pyLoad web interface in an isolated process and report observable results.

The hidden tests run one scenario per process because the web interface's theme
extension can only be attached once per interpreter.  The scenario builds a real
pyLoad core with a fresh data directory, writes the deployment configuration the
scenario asks for, drives the public HTTP endpoints through Flask's test client
(the same WSGI application the server runs), and prints one JSON object on stdout.

It is test harness code: it imports the product only to drive its real entry
points and never asserts anything itself.
"""

import json
import logging
import os
import sys


def _write_user_config(userdir, trusted_proxies):
    settings = os.path.join(userdir, "settings")
    os.makedirs(settings, exist_ok=True)
    lines = ["version: 2 ", 'webui - "Web Interface":']
    if trusted_proxies is not None:
        lines.append(
            '\tint trusted_proxies : "Trusted reverse proxy hops" = %d'
            % int(trusted_proxies)
        )
    with open(os.path.join(settings, "pyload.cfg"), "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines) + "\n")


class _Collector(logging.Handler):
    def __init__(self):
        super().__init__(level=logging.DEBUG)
        self.messages = []

    def emit(self, record):
        try:
            self.messages.append(record.getMessage())
        except Exception:
            pass


def main():
    spec = json.loads(sys.argv[1])
    userdir = spec["userdir"]
    os.makedirs(userdir, exist_ok=True)
    _write_user_config(userdir, spec.get("trusted_proxies"))

    from pyload.core import Core

    try:
        core = Core(
            userdir=userdir,
            tempdir=os.path.join(userdir, "tmp"),
            storagedir=None,
            debug=True,
            reset=None,
            dry=False,
            api_spec=False,
        )
    except Exception as exc:  # noqa: BLE001 - reported, judged by the test
        print("__RESULT__" + json.dumps({"build_error": "%s: %s" % (type(exc).__name__, exc)}))
        return

    try:
        app = core.webserver.app
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False

        if spec.get("enable_clicknload"):
            core.config.set_plugin("ClickNLoad", "enabled", True)

        api_key = core.api.generate_apikey("pyload", "pyload")["data"]["key"]

        collector = _Collector()
        root = logging.getLogger("pyload")
        root.setLevel(logging.DEBUG)
        root.addHandler(collector)

        client = app.test_client()
        results = []
        for action in spec.get("actions", []):
            headers = {}
            for key, value in (action.get("headers") or {}).items():
                headers[key] = value.replace("__API_KEY__", api_key)

            environ_base = {}
            if "remote" in action:
                environ_base["REMOTE_ADDR"] = action["remote"]

            kwargs = {
                "method": action.get("method", "GET"),
                "headers": headers,
                "environ_base": environ_base,
            }
            if action.get("base_url"):
                kwargs["base_url"] = action["base_url"]
            if action.get("data") is not None:
                kwargs["data"] = action["data"]
            if action.get("json") is not None:
                kwargs["json"] = action["json"]

            response = client.open(action["path"], **kwargs)
            results.append(
                {
                    "status": response.status_code,
                    "remaining": response.headers.get("X-RateLimit-Remaining"),
                    "body": response.get_data(as_text=True)[:200],
                }
            )

        root.removeHandler(collector)
        print("__RESULT__" + json.dumps({"results": results, "logs": collector.messages}))
    finally:
        try:
            core.terminate()
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 - harness failure is reported, not hidden
        print("__RESULT__" + json.dumps({"harness_error": "%s: %s" % (type(exc).__name__, exc)}))
        sys.exit(0)
