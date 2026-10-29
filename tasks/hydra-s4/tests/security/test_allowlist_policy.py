"""An allowlist decides which callables a call may use; it does not launder one.

These cases pass an allowlist that permits the helper doing the selection (and,
in one case, the receiver it reads) but not the callable the policy refuses.
"""

import os
import tempfile
import unittest

from hydra.utils import instantiate

from support import assert_not_produced, os_module


class AllowlistPolicyCases(unittest.TestCase):
    def setUp(self):
        fd, self.marker = tempfile.mkstemp(prefix="hydra-s4-")
        os.close(fd)
        self.addCleanup(lambda: os.path.exists(self.marker) and os.unlink(self.marker))

    def _refused(self, config, whitelist, invoke_args=()):
        assert_not_produced(
            self,
            lambda: instantiate(config, _target_whitelist_=whitelist),
            self.marker,
            invoke_args,
        )

    def test_allowlisted_lookup_still_checks_selected_value(self):
        self._refused(
            {"_target_": "hydra.utils.get_object", "_args_": ["os.remove"]},
            ["hydra.utils.get_object"],
        )

    def test_allowlisted_attribute_lookup_still_checks_selected_value(self):
        self._refused(
            {"_target_": "builtins.getattr", "_args_": [os_module(), "remove"]},
            ["builtins.getattr", "hydra.utils.get_object", "os"],
        )

    def test_allowlisted_deferred_selection_still_checks_the_callable(self):
        self._refused(
            {
                "_target_": "builtins.getattr",
                "_args_": [os_module(), "remove"],
                "_partial_": True,
            },
            ["builtins.getattr", "hydra.utils.get_object", "os"],
        )

    def test_allowlisted_method_lookup_still_checks_selected_value(self):
        self._refused(
            {"_target_": "hydra.utils.get_method", "_args_": ["os.remove"]},
            ["hydra.utils.get_method"],
        )


if __name__ == "__main__":
    unittest.main()
