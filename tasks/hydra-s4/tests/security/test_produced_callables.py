"""A config must not make instantiation produce a callable the policy refuses.

Each case supplies one shape of config and then proves the refused callable was
neither returned nor reachable through what was returned.  All cases use the
project's own default policy: the named target is already refused when it
appears as the entry's target.
"""

import functools
import os
import tempfile
import unittest

from hydra.utils import instantiate

from support import Holder, REFUSED, assert_not_produced, os_module


class ProducedCallableCases(unittest.TestCase):
    def setUp(self):
        fd, self.marker = tempfile.mkstemp(prefix="hydra-s4-")
        os.close(fd)
        self.addCleanup(lambda: os.path.exists(self.marker) and os.unlink(self.marker))

    def _refused(self, config, invoke_args=()):
        assert_not_produced(
            self, lambda: instantiate(config), self.marker, invoke_args
        )

    # -- a documented dotpath lookup returns the refused callable ----------
    def test_object_lookup_returns_refused_callable(self):
        self._refused(
            {"_target_": "hydra.utils.get_object", "_args_": ["os.remove"]}
        )

    def test_method_lookup_returns_refused_callable(self):
        self._refused(
            {"_target_": "hydra.utils.get_method", "_args_": ["os.remove"]}
        )

    def test_internal_resolver_returns_refused_callable(self):
        self._refused(
            {
                "_target_": "hydra._internal.utils._locate",
                "_args_": ["os.remove"],
            }
        )

    # -- attribute selection returns the refused callable -------------------
    def test_attribute_lookup_returns_refused_callable(self):
        self._refused(
            {
                "_target_": "builtins.getattr",
                "_args_": [os_module(), "remove"],
            }
        )

    def test_object_attribute_access_returns_refused_callable(self):
        self._refused(
            {
                "_target_": "builtins.object.__getattribute__",
                "_args_": [os_module(), "remove"],
            }
        )

    def test_type_attribute_access_returns_refused_callable(self):
        self._refused(
            {
                "_target_": "builtins.type.__getattribute__",
                "_args_": [Holder, "remove"],
            }
        )

    # -- a deferred value built by a target wraps the refused callable ------
    def test_partial_target_wraps_resolved_refused_callable(self):
        self._refused(
            {"_target_": "functools.partial", "_args_": [REFUSED]},
            invoke_args=(self.marker,),
        )

    def test_partial_target_wraps_looked_up_refused_callable(self):
        self._refused(
            {
                "_target_": "functools.partial",
                "_args_": [
                    {"_target_": "hydra.utils.get_object", "_args_": ["os.remove"]}
                ],
            },
            invoke_args=(self.marker,),
        )


if __name__ == "__main__":
    unittest.main()
