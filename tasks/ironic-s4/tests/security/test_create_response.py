"""The create response: a caller permitted to create a target but not to view its
connection configuration must not receive the settings it just supplied."""

from harness import MANAGER_ROLES, SECRET_PROPS, ApiCase


class TestCreateResponse(ApiCase):

    def test_create_withholds_settings_from_caller_without_view_permission(self):
        body = {
            "node_uuid": self.node["uuid"],
            "volume_type": "iscsi",
            "boot_index": 7,
            "volume_id": "volume-created-1",
            "properties": dict(SECRET_PROPS),
        }
        response = self.api_post("/v1/volume/targets", body, roles=MANAGER_ROLES)
        self.assertLess(response.status_int, 500)
        self.assert_no_settings(response)
