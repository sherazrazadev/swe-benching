"""Values the policy allows keep flowing through instantiation unchanged."""

import functools
import json
import math
import os
import types
import unittest

from hydra.utils import instantiate

from support import Holder, os_module, quiet


class AllowedValuesKeepWorking(unittest.TestCase):
    def test_lookup_returns_allowed_callable(self):
        got = quiet(instantiate, {"_target_": "hydra.utils.get_object", "_args_": ["math.sqrt"]})
        self.assertIs(got, math.sqrt)

    def test_lookup_returns_plain_object(self):
        got = quiet(instantiate, {"_target_": "hydra.utils.get_object", "_args_": ["os"]})
        self.assertIs(got, os)

    def test_attribute_lookup_returns_non_callable(self):
        got = quiet(
            instantiate,
            {
                "_target_": "builtins.getattr",
                "_args_": [{"_target_": "types.SimpleNamespace", "value": 10}, "value"],
            },
        )
        self.assertEqual(got, 10)

    def test_attribute_lookup_returns_allowed_callable(self):
        got = quiet(
            instantiate,
            {
                "_target_": "builtins.getattr",
                "_args_": [{"_target_": "types.SimpleNamespace", "sqrt": math.sqrt}, "sqrt"],
            },
        )
        self.assertIs(got, math.sqrt)

    def test_object_attribute_access_returns_non_callable(self):
        got = quiet(
            instantiate,
            {
                "_target_": "builtins.object.__getattribute__",
                "_args_": [{"_target_": "types.SimpleNamespace", "value": 7}, "value"],
            },
        )
        self.assertEqual(got, 7)

    def test_object_attribute_access_returns_allowed_callable(self):
        got = quiet(
            instantiate,
            {
                "_target_": "builtins.object.__getattribute__",
                "_args_": [{"_target_": "types.SimpleNamespace", "sqrt": math.sqrt}, "sqrt"],
            },
        )
        self.assertIs(got, math.sqrt)

    def test_type_attribute_access_returns_allowed_callable(self):
        got = quiet(
            instantiate,
            {
                "_target_": "builtins.type.__getattribute__",
                "_args_": [Holder, "sqrt"],
            },
        )
        self.assertIs(got, math.sqrt)

    def test_partial_target_of_allowed_callable_calls(self):
        got = quiet(
            instantiate,
            {"_target_": "functools.partial", "_args_": [math.sqrt]},
        )
        self.assertIsInstance(got, functools.partial)
        self.assertEqual(got(9.0), 3.0)

    def test_partial_flag_on_allowed_target_calls(self):
        got = quiet(
            instantiate, {"_target_": "math.sqrt", "_partial_": True}
        )
        self.assertEqual(got(16.0), 4.0)

    def test_factory_helper_returns_allowed_callable(self):
        got = quiet(instantiate, {"_target_": "hydra.utils.get_factory", "_args_": ["math.sqrt"]})
        self.assertIs(got, math.sqrt)

    def test_fallback_resolver_uses_first_resolving_candidate(self):
        got = quiet(
            instantiate,
            {
                "_target_": "hydra._internal.utils.resolve_dotpath",
                "_args_": [["not.a.module", "math.sqrt"]],
            },
        )
        self.assertIs(got, math.sqrt)

    def test_call_alias_instantiates(self):
        got = quiet(
            __import__("hydra.utils", fromlist=["call"]).call,
            {"_target_": "math.sqrt", "_args_": [25.0]},
        )
        self.assertEqual(got, 5.0)

    def test_plain_class_instantiates(self):
        got = quiet(
            instantiate,
            {"_target_": "types.SimpleNamespace", "value": 3},
        )
        self.assertEqual(got.value, 3)

    def test_nested_lookup_in_a_value_position_works(self):
        cfg = {"module": os_module()}
        got = quiet(instantiate, cfg)
        self.assertIs(got["module"], os)


class AllowlistKeepsItsMeaning(unittest.TestCase):
    def test_exact_entry_binds_reexported_target(self):
        got = quiet(
            instantiate,
            {"_target_": "json.JSONDecoder"},
            _target_whitelist_=["json.JSONDecoder"],
        )
        self.assertIsInstance(got, json.JSONDecoder)

    def test_wildcard_entry_binds_package_member(self):
        got = quiet(
            instantiate,
            {"_target_": "json.JSONDecoder"},
            _target_whitelist_=["json.*"],
        )
        self.assertIsInstance(got, json.JSONDecoder)

    def test_allowlisted_lookup_returns_allowed_callable(self):
        got = quiet(
            instantiate,
            {"_target_": "hydra.utils.get_object", "_args_": ["math.sqrt"]},
            _target_whitelist_=["hydra.utils.get_object", "math.sqrt"],
        )
        self.assertIs(got, math.sqrt)

    def test_allowlisted_attribute_lookup_returns_allowed_callable(self):
        got = quiet(
            instantiate,
            {
                "_target_": "builtins.getattr",
                "_args_": [{"_target_": "types.SimpleNamespace", "sqrt": math.sqrt}, "sqrt"],
            },
            _target_whitelist_=["builtins.getattr", "types.SimpleNamespace", "math.sqrt"],
        )
        self.assertIs(got, math.sqrt)

    def test_allowlisted_partial_flag_returns_a_callable(self):
        got = quiet(
            instantiate,
            {"_target_": "math.sqrt", "_partial_": True},
            _target_whitelist_=["math.sqrt"],
        )
        self.assertEqual(got(36.0), 6.0)

    def test_explicit_opt_out_disables_checks(self):
        from hydra.utils import UNSAFE_ALLOW_ALL_TARGETS

        got = quiet(
            instantiate,
            {"_target_": "hydra.utils.get_object", "_args_": ["os.remove"]},
            _target_whitelist_=UNSAFE_ALLOW_ALL_TARGETS,
        )
        self.assertIs(got, os.remove)


if __name__ == "__main__":
    unittest.main()
