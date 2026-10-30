#!/bin/bash
# Reference fix: no checkpoint value may steer code resolution. The custom-code setting and its
# two resolution sites are removed from the keypoint-matching configuration and model, from the
# modular source that generates them, and from the sibling integration that carries the same
# mechanism; nested detector configurations are always built from the built-in mapping and the
# detector model is always resolved locally. Ordinary nested detector configurations, default
# configurations, and model construction keep working with their supplied values.
set -euo pipefail
cd /workspace
patch -p1 < /solution/fix.patch
