"""Every dotpath helper the library exposes is a way into instantiation.

The library ships a factory lookup and an internal resolver that accepts one
candidate dotpath or a sequence of candidates.  A config can use either as its
target and have instantiation hand back a callable the policy refuses.
"""

import os
import tempfile
import unittest

from hydra.utils import instantiate

from support import assert_not_produced


class InjectedHelperCases(unittest.TestCase):
    def setUp(self):
        fd, self.marker = tempfile.mkstemp(prefix="hydra-s4-")
        os.close(fd)
        self.addCleanup(lambda: os.path.exists(self.marker) and os.unlink(self.marker))

    def _refused(self, config, whitelist=None):
        assert_not_produced(
            self,
            lambda: (
                instantiate(config)
                if whitelist is None
                else instantiate(config, _target_whitelist_=whitelist)
            ),
            self.marker,
        )

    def test_factory_helper_returns_refused_callable(self):
        self._refused(
            {"_target_": "hydra.utils.get_factory", "_args_": ["os.remove"]}
        )

    def test_factory_helper_returns_refused_callable_under_allowlist(self):
        self._refused(
            {"_target_": "hydra.utils.get_factory", "_args_": ["os.remove"]},
            ["hydra.utils.get_factory"],
        )

    def test_fallback_resolver_returns_refused_callable(self):
        self._refused(
            {
                "_target_": "hydra._internal.utils.resolve_dotpath",
                "_args_": ["os.remove"],
            }
        )

    def test_fallback_resolver_sequence_returns_refused_callable(self):
        self._refused(
            {
                "_target_": "hydra._internal.utils.resolve_dotpath",
                "_args_": [["os.remove", "math.sqrt"]],
            }
        )

    def test_factory_helper_sequence_returns_refused_callable(self):
        self._refused(
            {"_target_": "hydra.utils.get_factory", "_args_": [["os.remove"]]}
        )


if __name__ == "__main__":
    unittest.main()
