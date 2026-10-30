#!/usr/bin/env python3
"""Compose the offline test classpath: the affected module, its resolved test dependencies, and
the module's own jar. Only the dependency closure is used (never every jar in the repository, which
would pull in optional integrations whose runtime dependencies are not present)."""
import os

RAW = "/opt/camel-test-cp.raw"
OUT = "/opt/camel-test-cp.txt"
MODULE_JAR = "/opt/m2/org/apache/camel/camel-knative-http/4.14.9-SNAPSHOT/camel-knative-http-4.14.9-SNAPSHOT.jar"


def main():
    parts = []
    with open(RAW, "r", encoding="utf-8") as f:
        parts.extend(p for p in f.read().strip().split(os.pathsep) if p)

    parts.append(MODULE_JAR)

    seen, ordered = set(), []
    for path in parts:
        if path not in seen and os.path.isfile(path):
            seen.add(path)
            ordered.append(path)

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(os.pathsep.join(ordered) + "\n")


if __name__ == "__main__":
    main()
