#!/usr/bin/env python3
"""Stand-in for the `msb` binary.

Records what the library put on the launched command line and on the other
channels it hands to the child, then answers the startup handshake so the
library's spawn call completes. No sandbox is booted.
"""
import json
import os
import sys


def read_descriptors():
    out = {}
    for fd in range(3, 256):
        try:
            os.set_blocking(fd, False)
        except OSError:
            continue
        try:
            data = os.read(fd, 4 * 1024 * 1024)
        except (OSError, ValueError):
            continue
        if data:
            out["fd:%d" % fd] = data.decode("utf-8", "replace")
    return out


def read_named_files(argv):
    out = {}
    for tok in argv:
        try:
            if os.path.isfile(tok) and 0 < os.path.getsize(tok) < 8 * 1024 * 1024:
                with open(tok, "rb") as handle:
                    out["file:" + tok] = handle.read().decode("utf-8", "replace")
        except OSError:
            continue
    return out


def startup_fd(argv):
    for index, tok in enumerate(argv):
        if tok == "--startup-fd" and index + 1 < len(argv):
            try:
                return int(argv[index + 1])
            except ValueError:
                return None
        if tok.startswith("--startup-fd="):
            try:
                return int(tok.split("=", 1)[1])
            except ValueError:
                return None
    return None


def main():
    argv = sys.argv[:]
    info = {"argv": argv, "env": dict(os.environ)}
    info["channels"] = read_named_files(argv)
    info["channels"].update(read_descriptors())
    dump = os.environ.get("MSB_TEST_DUMP")
    if dump:
        with open(dump, "w") as handle:
            json.dump(info, handle)

    line = json.dumps({"pid": os.getpid()}) + "\n"
    fd = startup_fd(argv)
    if fd is not None:
        os.write(fd, line.encode())
    else:
        sys.stdout.write(line)
        sys.stdout.flush()

    if len(argv) > 1 and argv[1] == "exec":
        return 0
    import time

    time.sleep(20)
    return 0


if __name__ == "__main__":
    sys.exit(main())
