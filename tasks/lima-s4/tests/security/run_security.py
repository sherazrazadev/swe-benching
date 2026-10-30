#!/usr/bin/env python3
"""Hidden security suite for lima-s4.

Every test drives a real entry point: the product's boot-time install script,
the service definition it generates, or the agent's own command line. It then
proves both halves of the invariant: the instance's main user is served, and a
different local user in the same guest cannot use the agent.
"""
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "support"))

import junit  # noqa: E402
import sandbox  # noqa: E402
from sandbox import MAIN_UID, OTHER_UID, ROOT_UID, DirectRootSandbox, RootlessSandbox, Sandbox  # noqa: E402

TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


@test
def test_sec_systemd_install_route_only_main_user():
    with Sandbox("systemd", main_uid=MAIN_UID) as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        sb.start()
        assert sb.usable_by(MAIN_UID), "the main user cannot use the agent installed by the systemd route"
        assert sb.denied_by(OTHER_UID), "another local user can use the agent installed by the systemd route"


@test
def test_sec_openrc_boot_route_only_main_user():
    with Sandbox("openrc", main_uid=MAIN_UID) as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        assert os.path.isfile(os.path.join(sb.jail, "etc", "init.d", "lima-guestagent")), \
            "the openrc service definition was not written"
        sb.start()
        assert sb.usable_by(MAIN_UID), "the main user cannot use the agent started by the openrc route"
        assert sb.denied_by(OTHER_UID), "another local user can use the agent started by the openrc route"


@test
def test_sec_legacy_init_route_only_main_user():
    with Sandbox("sysv", main_uid=MAIN_UID) as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        assert os.path.isfile(os.path.join(sb.jail, "etc", "init.d", "lima-guestagent")), \
            "the legacy service definition was not written"
        sb.start()
        assert sb.usable_by(MAIN_UID), "the main user cannot use the agent started by the legacy init route"
        assert sb.denied_by(OTHER_UID), "another local user can use the agent started by the legacy init route"


@test
def test_sec_unprivileged_mode_only_main_user():
    with RootlessSandbox(uid=MAIN_UID) as sb:
        sb.start()
        assert sb.usable_by(MAIN_UID), "the main user cannot use the agent in its unprivileged mode"
        assert sb.denied_by(OTHER_UID), "another local user can use the agent in its unprivileged mode"


@test
def test_sec_agent_started_without_owner_serves_root_only():
    with DirectRootSandbox() as sb:
        sb.start()
        assert sb.usable_by(ROOT_UID), "the agent started without a main user does not serve root"
        assert sb.denied_by(MAIN_UID), "a non-root local user can use an agent that was given no main user"
        assert sb.denied_by(OTHER_UID), "a non-root local user can use an agent that was given no main user"


@test
def test_sec_systemd_route_with_root_as_main_user_only_root():
    with Sandbox("systemd", main_uid=ROOT_UID) as sb:
        boot = sb.run_boot()
        assert boot.returncode == 0, "the boot-time install failed: %s" % boot.stdout[-800:]
        sb.start()
        assert sb.usable_by(ROOT_UID), "the root main user cannot use the agent"
        assert sb.denied_by(MAIN_UID), "another local user can use an agent whose main user is root"
        assert sb.denied_by(OTHER_UID), "another local user can use an agent whose main user is root"


def main(out_path):
    cases = []
    for fn in TESTS:
        try:
            fn()
            cases.append((fn.__name__, "pass", ""))
        except AssertionError as e:
            cases.append((fn.__name__, "fail", str(e) + "\n" + traceback.format_exc()[-3000:]))
        except Exception as e:  # noqa: BLE001
            cases.append((fn.__name__, "error", "%s: %s\n%s" % (type(e).__name__, e,
                                                                traceback.format_exc()[-3000:])))
    junit.write_junit(out_path, "security", cases)
    for name, status, message in cases:
        print("%s %s%s" % (status, name, "" if status == "pass" else ": " + message.splitlines()[0]))
    return 0 if all(s == "pass" for _, s, _ in cases) else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: run_security.py OUT.xml", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
