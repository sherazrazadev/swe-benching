"""Shared harness: the real ironic API application, real oslo.policy decisions and
keystone-style role headers, backed by the in-memory SQLite test database.

The authority stub is the real policy engine (ironic's own policy defaults and
scope enforcement); only the keystone token middleware is replaced with a no-op,
exactly as ironic's own RBAC unit tests do, so the roles in the request headers
are what the policy engine sees.  Outcomes are therefore per-resource and
per-verb, not one blanket answer.
"""
from unittest import mock

from oslo_config import cfg

from ironic.api.controllers import base as api_base
from ironic.api.controllers.v1 import versions as api_versions
from ironic.conductor import rpcapi
from ironic.db import api as db_api
from ironic.objects import notification as notification_obj
from ironic.tests.unit.api.test_acl import TestACLBase
from ironic.tests.unit.db import utils as db_utils

OWNER_PROJECT = "70e5e25a-2ca2-4cb1-8ae8-7d8739cee205"
NODE_UUID = "1ab63b9e-66d7-4cd7-8618-dddd0f9f7881"
TARGET_UUID = "a265e2f0-e97f-4177-b1c0-8298add53086"
CONNECTOR_UUID = "65ea0296-219b-4635-b0c8-a6e055da878d"
VOLUME_ID = "volume-9f3a6c"

# Connection settings stored on the target.  The values are markers so that a test
# can tell whether any of them reached a response.
SECRET_PROPS = {
    "target_iqn": "iqn.2024-01.example:storage",
    "target_portal": "10.20.30.40:3260",
    "auth_username": "chap-login",
    "auth_password": "CHAP-Secret-Marker-9f3a",
}
SECRET_VALUES = tuple(SECRET_PROPS.values())
# A value in a field that is not connection configuration; it must be untouched.
EXTRA_MARKER = "unrelated-extra-marker"

# Project-scoped role sets, matching ironic's RBAC model:
#   admin/manager/member/reader cascade; the view-target-properties rule allows
#   system readers and the project admin role only.
ADMIN_ROLES = "admin,manager,member,reader"
MEMBER_ROLES = "member,reader"
READER_ROLES = "reader"
MANAGER_ROLES = "manager,member,reader"


def api_headers(roles, project=OWNER_PROJECT):
    return {
        "X-Auth-Token": "token-" + roles.replace(",", "-"),
        "X-Roles": roles,
        "X-Project-Id": project,
        api_base.Version.string: api_versions.max_version_string(),
    }


class ApiCase(TestACLBase):
    """Real pecan app + real policy + fake token middleware."""

    def _create_test_data(self):
        self.node = db_utils.create_test_node(uuid=NODE_UUID,
                                              owner=OWNER_PROJECT)
        self.target = db_utils.create_test_volume_target(
            node_id=self.node["id"], uuid=TARGET_UUID,
            volume_id=VOLUME_ID, properties=dict(SECRET_PROPS),
            extra={"auth_password": EXTRA_MARKER})
        self.connector = db_utils.create_test_volume_connector(
            node_id=self.node["id"], uuid=CONNECTOR_UUID,
            extra={"auth_password": EXTRA_MARKER})

    def _set_test_config(self):
        cfg.CONF.set_override("enforce_scope", True, group="oslo_policy")
        cfg.CONF.set_override("enforce_new_defaults", True,
                              group="oslo_policy")

    def setUp(self):
        super(ApiCase, self).setUp()
        # No conductor is reachable; topic lookup and the update RPC are local.
        self.mock_topic.side_effect = None
        self.mock_topic.return_value = "ironic-conductor"
        self.mock_auth.side_effect = self._fake_process_request

        # Capture notifications instead of sending them to a message bus.
        self.notifications = []
        captured = self.notifications

        def _capture(notification_self, context):
            captured.append(notification_self.payload.obj_to_primitive())

        p = mock.patch.object(notification_obj.NotificationBase, "emit",
                              _capture)
        p.start()
        self.addCleanup(p.stop)

        def _persist_update(self_, context, target, topic):
            # The conductor would persist the changed fields; do the same here so
            # behavioural tests can observe stored state.
            target.save()
            return target

        self._update_patch = mock.patch.object(
            rpcapi.ConductorAPI, "update_volume_target", autospec=True,
            side_effect=_persist_update)
        self.mock_update = self._update_patch.start()
        self.addCleanup(self._update_patch.stop)

    # -- request helpers -------------------------------------------------
    def api_get(self, path, roles=ADMIN_ROLES, project=OWNER_PROJECT):
        return self.get_json(path, headers=api_headers(roles, project),
                             expect_errors=True, path_prefix="")

    def api_post(self, path, body, roles=MANAGER_ROLES,
                 project=OWNER_PROJECT):
        return self.post_json(path, body, headers=api_headers(roles, project),
                              expect_errors=True, path_prefix="")

    def api_patch(self, path, body, roles=MEMBER_ROLES,
                  project=OWNER_PROJECT):
        return self.patch_json(path, body,
                               headers=api_headers(roles, project),
                               expect_errors=True, path_prefix="")

    # -- stored state ----------------------------------------------------
    def stored_target(self):
        return db_api.get_instance().get_volume_target_by_uuid(TARGET_UUID)

    def stored_properties(self):
        return self.stored_target()["properties"]

    def update_body(self, path="/extra/note", value="updated"):
        return [{"op": "add", "path": path, "value": value}]

    def assert_no_settings(self, response, message="connection settings"):
        """The response must not carry any connection setting value."""
        body = response.text
        for value in SECRET_VALUES:
            self.assertNotIn(value, body,
                             "%s leaked to the response: %r" % (message, value))

    def assert_secret_withheld(self, response):
        """A secret value must not be in clear text in the response."""
        self.assertNotIn(SECRET_PROPS["auth_password"], response.text)
