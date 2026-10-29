"""Deferring a config selection must not postpone the policy decision.

When instantiation returns a value that will select or call the real callable
later, the policy still applies: the refused callable must not be reachable by
using the returned value.
"""

import os
import tempfile
import unittest

from hydra.utils import instantiate

from support import Holder, assert_not_produced, os_module


class DeferredSelectionCases(unittest.TestCase):
    def setUp(self):
        fd, self.marker = tempfile.mkstemp(prefix="hydra-s4-")
        os.close(fd)
        self.addCleanup(lambda: os.path.exists(self.marker) and os.unlink(self.marker))

    def _refused(self, config, invoke_args=()):
        assert_not_produced(
            self, lambda: instantiate(config), self.marker, invoke_args
        )

    def test_deferred_attribute_selection_is_refused(self):
        self._refused(
            {
                "_target_": "builtins.getattr",
                "_args_": [os_module(), "remove"],
                "_partial_": True,
            }
        )

    def test_deferred_object_attribute_access_is_refused(self):
        self._refused(
            {
                "_target_": "builtins.object.__getattribute__",
                "_args_": [os_module(), "remove"],
                "_partial_": True,
            }
        )

    def test_deferred_lookup_is_refused(self):
        self._refused(
            {
                "_target_": "hydra.utils.get_object",
                "_args_": ["os.remove"],
                "_partial_": True,
            }
        )

    def test_deferred_type_attribute_access_is_refused(self):
        self._refused(
            {
                "_target_": "builtins.type.__getattribute__",
                "_args_": [Holder, "remove"],
                "_partial_": True,
            }
        )


if __name__ == "__main__":
    unittest.main()
