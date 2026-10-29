"""pytest compatibility for ironic's unit-test base classes.

ironic's ``TestCase._clear_attrs`` deletes every non-underscore instance attribute
during cleanup.  pytest installs the bound test method as an instance attribute
just before invoking the test, so the cleanup removes it and pytest's later
``delattr`` raises.  Keeping the test method name in place leaves the product
behaviour otherwise unchanged.  This module is test-side bookkeeping only.
"""


def pytest_configure(config):
    # Select oslo_service's threading backend before oslo_messaging would pick
    # eventlet; ironic's test package does the same at import time.
    import ironic.tests.unit  # noqa: F401
    import ironic.tests.base as itb

    if getattr(itb.TestCase._clear_attrs, "_pytest_safe", False):
        return

    def _clear_attrs(self):
        for key in [k for k in self.__dict__
                    if k[0] != "_" and not k.startswith("test")]:
            del self.__dict__[key]

    _clear_attrs._pytest_safe = True
    itb.TestCase._clear_attrs = _clear_attrs
