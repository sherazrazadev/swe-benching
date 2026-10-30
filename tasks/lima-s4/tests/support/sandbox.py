"""Sandbox helpers for the lima-s4 hidden suites.

The guest agent is a root daemon reached over a UNIX socket. The suites run it
the way a guest does: through the product's own boot script and the service
definition that script produces, inside a minimal chroot that holds only the
agent binary and the tools the boot script needs. The chroot contains no test
or verifier files.

Everything here computes its own expectations (uids, socket paths) from the
inputs the test supplies; no product code is imported.
"""
import collections
import os
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time

MAIN_UID = 1000          # the verifier's unprivileged uid-1000 `agent` user
OTHER_UID = 1001         # a second local user in the guest
ROOT_UID = 0

WORKSPACE = os.environ.get("LIMA_S4_WORKSPACE", "/workspace")
BINARY = os.environ.get("LIMA_S4_BINARY", os.path.join(WORKSPACE, ".htests", "bin", "lima-guestagent"))
JAIL_BASE = "/opt/lima-s4/jail-base"
BOOT_SCRIPT_REL = os.path.join("pkg", "cidata", "cidata.TEMPLATE.d", "boot.Linux", "25-guestagent-base.sh")
GUEST_SOCKET = "/run/lima-guestagent.sock"

CHROOT = "/usr/sbin/chroot"
SETPRIV = "/usr/bin/setpriv"

BootResult = collections.namedtuple("BootResult", "returncode stdout")

# Runs as the probed user. Exit 0 only when the agent actually served the
# connection: connect, send the HTTP/2 client preface, and require a server
# byte. A refused user either cannot connect or is closed before any byte.
PROBE = (
    "import socket,sys\n"
    "s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)\n"
    "s.settimeout(4.0)\n"
    "try:\n"
    "    s.connect(sys.argv[1])\n"
    "except OSError as e:\n"
    "    print('CONNECT', e.errno); sys.exit(2)\n"
    "try:\n"
    "    s.sendall(b'PRI * HTTP/2.0\\r\\n\\r\\nSM\\r\\n\\r\\n')\n"
    "    d=s.recv(64)\n"
    "except OSError as e:\n"
    "    print('READ', e.errno); sys.exit(3)\n"
    "print('SERVED' if d else 'CLOSED')\n"
    "sys.exit(0 if d else 4)\n"
)


def _write(path, text, mode=0o755):
    with open(path, "w") as f:
        f.write(text)
    os.chmod(path, mode)


def _classify(p):
    out = (p.stdout or "").strip()
    if p.returncode == 0 and out == "SERVED":
        return "served"
    if out.startswith("CONNECT"):
        code = out.split()[1] if len(out.split()) > 1 else ""
        if code in ("13", "1"):      # EACCES / EPERM
            return "denied"
        if code in ("2", "111"):     # ENOENT / ECONNREFUSED
            return "notready"
        return "error:" + out
    if out == "CLOSED":
        return "closed"
    return "error:" + (out or "exit %d" % p.returncode)


def _probe_user(uid, path):
    if uid == ROOT_UID:
        cmd = ["python3", "-I", "-c", PROBE, path]
    else:
        cmd = [SETPRIV, "--reuid=%d" % uid, "--regid=%d" % uid, "--clear-groups",
               "python3", "-I", "-c", PROBE, path]
    env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/tmp", "LANG": "C.UTF-8"}
    try:
        p = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        return "timeout"
    return _classify(p)


def usable_by(uid, path, retries=10):
    for _ in range(retries):
        status = _probe_user(uid, path)
        if status == "served":
            return True
        if status in ("denied", "closed"):
            return False
        time.sleep(0.25)
    return False


def denied_by(uid, path):
    """True when the user cannot use the agent; retries only on not-ready."""
    for _ in range(10):
        status = _probe_user(uid, path)
        if status == "served":
            return False
        if status in ("denied", "closed"):
            return True
        time.sleep(0.25)
    return True


def _wait_socket(path, timeout=20.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            if stat.S_ISSOCK(os.stat(path).st_mode):
                return True
        except OSError:
            pass
        time.sleep(0.1)
    return False


def _kill_session(proc):
    if proc is None or proc.poll() is not None:
        return
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(os.getpgid(proc.pid), sig)
        except OSError:
            pass
        try:
            proc.wait(timeout=3)
            return
        except subprocess.TimeoutExpired:
            continue


class Sandbox:
    """One chroot with the built agent, the product boot script and stubs."""

    def __init__(self, mode, main_uid=MAIN_UID, vsock="0", virtio="", mounttype="disabled"):
        self.mode = mode
        self.main_uid = main_uid
        self.vsock = str(vsock)
        self.virtio = virtio
        self.mounttype = mounttype
        self.root = tempfile.mkdtemp(prefix="lima-s4-jail.")
        os.chmod(self.root, 0o755)      # other local users must be able to reach the socket
        self.jail = os.path.join(self.root, "jail")
        self.proc = None
        self.bg_pid = None
        shutil.copytree(JAIL_BASE, self.jail, symlinks=True)
        self._prepare()

    # ----- construction ---------------------------------------------------
    def _prepare(self):
        j = self.jail
        for d in ("sbin", "usr/sbin", "etc/conf.d", "etc/init.d", "etc/default", "etc/systemd/system",
                  "run", "tmp", "dev", "mnt/lima-cidata/boot.Linux", "opt/lima/bin", "proc/self"):
            os.makedirs(os.path.join(j, d), exist_ok=True)
        # A regular file is enough for the script's `2>/dev/null` redirections.
        _write(os.path.join(j, "dev", "null"), "", 0o666)
        # The product's install-systemd locates itself through /proc/self/exe.
        os.symlink("/opt/lima/bin/lima-guestagent", os.path.join(j, "proc/self/exe"))
        stubs = {
            "sbin/sudo": "#!/bin/bash\nexec \"$@\"\n",
            "sbin/rc-update": "#!/bin/bash\nexit 0\n",
            "sbin/rc-service": "#!/bin/bash\nexit 0\n",
            "sbin/systemctl": "#!/bin/bash\nexit 0\n",
        }
        for name, text in stubs.items():
            if name == "sbin/systemctl" and self.mode == "sysv":
                continue            # a host with no service manager
            _write(os.path.join(j, name), text)
        if self.mode == "openrc":
            _write(os.path.join(j, "sbin", "openrc-run"), "", 0o755)
        for name in ("passwd", "group"):
            shutil.copyfile(os.path.join("/etc", name), os.path.join(j, "etc", name))
        shutil.copyfile(BINARY, os.path.join(j, "opt", "lima", "bin", "lima-guestagent"))
        os.chmod(os.path.join(j, "opt", "lima", "bin", "lima-guestagent"), 0o755)
        shutil.copyfile(BINARY, os.path.join(j, "mnt", "lima-cidata", "lima-guestagent"))
        src = os.path.join(WORKSPACE, BOOT_SCRIPT_REL)
        if not os.path.isfile(src):
            raise RuntimeError("the product boot script is missing from the submission")
        shutil.copyfile(src, os.path.join(j, "mnt", "lima-cidata", "boot.Linux", "25-guestagent-base.sh"))
        env = {
            "LIMA_CIDATA_DEBUG": "false",
            "LIMA_CIDATA_UID": str(self.main_uid),
            "LIMA_CIDATA_USER": "lima",
            "LIMA_CIDATA_HOME": "/home/lima",
            "LIMA_CIDATA_GUEST_INSTALL_PREFIX": "/opt/lima",
            "LIMA_CIDATA_MOUNTTYPE": self.mounttype,
            "LIMA_CIDATA_MOUNTS": "0",
            "LIMA_CIDATA_VSOCK_PORT": self.vsock,
            "LIMA_CIDATA_VIRTIO_PORT": self.virtio,
        }
        _write(os.path.join(j, "mnt", "lima-cidata", "lima.env"),
               "".join("%s=%s\n" % kv for kv in env.items()), 0o644)

    # ----- the product boot script ---------------------------------------
    def run_boot(self):
        log = os.path.join(self.root, "boot.log")
        env = {"LIMA_CIDATA_MNT": "/mnt/lima-cidata",
               "PATH": "/bin:/sbin:/usr/bin:/usr/sbin", "USER": "root", "HOME": "/root"}
        script = ("set -a; . /mnt/lima-cidata/lima.env; set +a; "
                  "export LIMA_CIDATA_MNT=/mnt/lima-cidata; "
                  "/bin/bash /mnt/lima-cidata/boot.Linux/25-guestagent-base.sh")
        with open(log, "wb") as f:
            p = subprocess.run([CHROOT, self.jail, "/bin/bash", "-c", script],
                               env=env, stdout=f, stderr=subprocess.STDOUT, timeout=180)
        text = ""
        try:
            with open(log, errors="replace") as f:
                text = f.read()
        except OSError:
            pass
        if self.mode == "sysv":
            self._read_pidfile()
        return BootResult(p.returncode, text)

    def _pidfile(self):
        return os.path.join(self.jail, "run", "lima-guestagent.pid")

    def _read_pidfile(self):
        for _ in range(50):
            if os.path.isfile(self._pidfile()):
                try:
                    self.bg_pid = int(open(self._pidfile()).read().strip())
                except (ValueError, OSError):
                    self.bg_pid = None
                return self.bg_pid
            time.sleep(0.1)
        return None

    # ----- service definitions -------------------------------------------
    def _unit_path(self):
        return os.path.join(self.jail, "etc", "systemd", "system", "lima-guestagent.service")

    def _systemd_env(self, unit):
        env = {}
        for raw in unit.splitlines():
            line = raw.strip()
            if line.startswith("Environment="):
                for tok in shlex.split(line[len("Environment="):]):
                    if "=" in tok:
                        k, v = tok.split("=", 1)
                        env[k] = v
            elif line.startswith("EnvironmentFile="):
                for path in shlex.split(line[len("EnvironmentFile="):].strip()):
                    optional = path.startswith("-")
                    path = path.lstrip("-").replace("%t", "/run").replace("%N", "lima-guestagent")
                    host = os.path.join(self.jail, path.lstrip("/"))
                    if not os.path.isfile(host):
                        if optional:
                            continue
                        raise RuntimeError("the unit names a missing environment file %s" % path)
                    for l in open(host):
                        l = l.strip()
                        if not l or l.startswith("#") or "=" not in l:
                            continue
                        k, v = l.split("=", 1)
                        env[k.strip()] = v.strip().strip('"')
        return env

    def systemd_exec(self):
        """(argv, environment) of the generated unit, read without starting it."""
        unit = open(self._unit_path()).read()
        line = None
        for raw in unit.splitlines():
            if raw.strip().startswith("ExecStart="):
                line = raw.strip()[len("ExecStart="):].strip()
                break
        if line is None:
            raise RuntimeError("the generated unit has no ExecStart")
        line = line.lstrip("-@+!")
        line = line.replace("%t", "/run").replace("%N", "lima-guestagent").replace("%n", "lima-guestagent")
        return shlex.split(line), self._systemd_env(unit)

    def openrc_script_text(self):
        return open(os.path.join(self.jail, "etc", "init.d", "lima-guestagent")).read()

    def _openrc_argv(self):
        runner = (
            "set -a\n"
            "[ -f /etc/conf.d/lima-guestagent ] && . /etc/conf.d/lima-guestagent\n"
            "set +a\n"
            ". /etc/init.d/lima-guestagent\n"
            "for f in ${env_file:-}; do [ -f \"$f\" ] && set -a && . \"$f\" && set +a; done\n"
            "[ -n \"${env:-}\" ] && export ${env}\n"
            "eval \"set -- $command_args\"\n"
            "exec $command \"$@\"\n"
        )
        _write(os.path.join(self.jail, "run-openrc.sh"), runner)
        return [CHROOT, self.jail, "/bin/bash", "/run-openrc.sh"]

    # ----- launching ------------------------------------------------------
    def start(self):
        """Start the agent through the route and wait for its socket."""
        base = {"PATH": "/bin:/sbin:/usr/bin:/usr/sbin", "USER": "root", "HOME": "/root"}
        if self.mode == "systemd":
            argv, env = self.systemd_exec()
            base.update(env)
            self.proc = subprocess.Popen([CHROOT, self.jail] + argv, env=base,
                                         start_new_session=True,
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif self.mode == "openrc":
            self.proc = subprocess.Popen(self._openrc_argv(), env=base, start_new_session=True,
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif self.mode == "sysv":
            if not os.path.isfile(self._pidfile()):
                self.proc = subprocess.Popen(
                    [CHROOT, self.jail, "/bin/sh", "/etc/init.d/lima-guestagent", "start"],
                    env=base, start_new_session=True,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                self._read_pidfile()
            else:
                self._read_pidfile()
        else:
            raise ValueError("unknown route %r" % self.mode)
        if not _wait_socket(self.socket_path):
            raise RuntimeError("the agent did not create its control socket (%s)" % self.socket_path)

    @property
    def socket_path(self):
        return os.path.join(self.jail, GUEST_SOCKET.lstrip("/"))

    def usable_by(self, uid):
        return usable_by(uid, self.socket_path)

    def denied_by(self, uid):
        return denied_by(uid, self.socket_path)

    # ----- teardown -------------------------------------------------------
    def stop(self):
        if self.bg_pid:
            for sig in (signal.SIGTERM, signal.SIGKILL):
                try:
                    os.kill(self.bg_pid, sig)
                except OSError:
                    break
                time.sleep(0.2)
            self.bg_pid = None
        _kill_session(self.proc)
        self.proc = None
        shutil.rmtree(self.root, ignore_errors=True)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.stop()
        return False


class DirectRootSandbox(Sandbox):
    """The agent started directly as root with no owner (legitimate default)."""

    def __init__(self):
        super().__init__("direct")

    def start(self):
        self.proc = subprocess.Popen(
            [CHROOT, self.jail, "/opt/lima/bin/lima-guestagent", "daemon", "--runtime-dir", "/run/lima-guestagent"],
            env={"PATH": "/bin:/sbin:/usr/bin:/usr/sbin", "USER": "root", "HOME": "/root"},
            start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not _wait_socket(self.socket_path):
            raise RuntimeError("the agent did not create its control socket")


class RootlessSandbox:
    """The agent started unprivileged, outside any chroot."""

    def __init__(self, uid=MAIN_UID):
        self.uid = uid
        self.runtime_dir = tempfile.mkdtemp(prefix="lima-s4-rootless.")
        os.chmod(self.runtime_dir, 0o755)
        os.chown(self.runtime_dir, uid, uid)
        self.proc = None

    def start(self):
        self.proc = subprocess.Popen(
            [SETPRIV, "--reuid=%d" % self.uid, "--regid=%d" % self.uid, "--clear-groups",
             "env", "USER=agent", "HOME=/tmp", BINARY,
             "daemon", "--rootless", "--tick", "3s", "--runtime-dir", self.runtime_dir],
            start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not _wait_socket(self.socket_path):
            raise RuntimeError("the agent did not create its control socket")

    @property
    def socket_path(self):
        return os.path.join(self.runtime_dir, "lima-guestagent.sock")

    def usable_by(self, uid):
        return usable_by(uid, self.socket_path)

    def denied_by(self, uid):
        return denied_by(uid, self.socket_path)

    def stop(self):
        _kill_session(self.proc)
        self.proc = None
        shutil.rmtree(self.runtime_dir, ignore_errors=True)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.stop()
        return False


def _copy_with_libs(src, dest_root):
    dst = os.path.join(dest_root, src.lstrip("/"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    try:
        out = subprocess.run(["ldd", src], capture_output=True, text=True, timeout=30).stdout
    except (OSError, subprocess.SubprocessError):
        return
    for line in out.splitlines():
        line = line.strip()
        lib = None
        if "=> /" in line:
            lib = "/" + line.split("=> /", 1)[1].split(" ")[0]
        elif line.startswith("/"):
            lib = line.split(" ")[0]
        if not lib or not os.path.exists(lib):
            continue
        target = os.path.join(dest_root, lib.lstrip("/"))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        if not os.path.exists(target):
            shutil.copy2(lib, target)


def main_jailbuild(dest):
    """Build the tool-only jail base used by every Sandbox."""
    tools = [
        "/bin/bash",
        "/usr/bin/sed", "/usr/bin/grep", "/usr/bin/sha256sum", "/usr/bin/install",
        "/usr/bin/id", "/usr/bin/seq", "/usr/bin/mkdir", "/usr/bin/chown", "/usr/bin/chmod",
        "/usr/bin/cat", "/usr/bin/rm", "/usr/bin/env", "/usr/bin/touch", "/usr/bin/ln",
        "/usr/bin/dirname", "/usr/bin/basename", "/usr/bin/printf", "/usr/bin/test",
        "/usr/bin/true", "/usr/bin/sleep", "/usr/bin/mv", "/usr/bin/cp", "/usr/bin/ls",
        "/usr/bin/sort", "/usr/bin/cut", "/usr/bin/tr", "/usr/bin/head", "/usr/bin/tail",
        "/usr/bin/mktemp",
    ]
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    for tool in tools:
        if os.path.exists(tool):
            _copy_with_libs(tool, dest)
    os.makedirs(os.path.join(dest, "bin"), exist_ok=True)
    link = os.path.join(dest, "bin", "sh")
    if os.path.lexists(link):
        os.unlink(link)
    os.symlink("/bin/bash", link)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: sandbox.py DEST", file=sys.stderr)
        sys.exit(2)
    main_jailbuild(sys.argv[1])
