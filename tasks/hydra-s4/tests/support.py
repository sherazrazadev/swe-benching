"""Shared helpers for the hidden suites.

``REFUSED`` is a target the project's own default policy already refuses (it
appears in the library's shipped list).  The security cases ask the
instantiation API to produce it through a config; a correct answer is that the
call refuses, or returns a value that raises when used instead of yielding it.

``assert_not_produced`` is deliberately tolerant about *how* the refusal is
delivered: a raised exception passes, and so does a deferred value that refuses
when called.  What never passes is the refused callable itself (or a deferred
value that hands it back), and a marker file disappearing proves it ran.
"""

import os
import warnings

REFUSED = os.remove


def quiet(call, *args, **kwargs):
    """Run a call with the legacy-policy deprecation warning muted."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return call(*args, **kwargs)


def os_module():
    """A config entry that resolves the standard-library ``os`` module."""
    return {"_target_": "hydra.utils.get_object", "_args_": ["os"]}


class Holder:
    """A class whose attributes exist for attribute-access cases."""

    remove = staticmethod(REFUSED)
    sqrt = staticmethod(__import__("math").sqrt)
    value = 10


def assert_not_produced(testcase, produce, marker, invoke_args=()):
    """The call must not produce REFUSED, directly or through a deferred value."""
    testcase.assertTrue(os.path.exists(marker), "fixture marker vanished before the call")
    try:
        produced = quiet(produce)
    except Exception:
        testcase.assertTrue(
            os.path.exists(marker), "the refused callable ran while the call was refused"
        )
        return
    testcase.assertIsNot(produced, REFUSED, "instantiate returned the refused callable")
    if not callable(produced):
        return
    try:
        yielded = quiet(produced, *invoke_args)
    except Exception:
        testcase.assertTrue(
            os.path.exists(marker), "the refused callable ran while being used"
        )
        return
    testcase.assertIsNot(yielded, REFUSED, "a deferred value yielded the refused callable")
    testcase.assertTrue(os.path.exists(marker), "the refused callable ran")
