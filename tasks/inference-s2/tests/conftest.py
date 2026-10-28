import os
import sys

os.environ.setdefault("XINFERENCE_HOME", "/tmp/xinference-test-home")
os.environ.setdefault("HF_HUB_OFFLINE", "1")

# The suites are copied to /workspace/.htests at grade time; make sibling modules importable.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
