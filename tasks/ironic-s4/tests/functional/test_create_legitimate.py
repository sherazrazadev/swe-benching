"""Legitimate creation keeps working and stores the supplied settings unchanged."""

from harness import ADMIN_ROLES, MANAGER_ROLES, SECRET_PROPS, ApiCase


class TestCreateLegitimate(ApiCase):

    def test_permitted_create_succeeds_and_stores_real_values(self):
        body = {
            "node_uuid": self.node["uuid"],
            "volume_type": "iscsi",
            "boot_index": 11,
            "volume_id": "volume-created-2",
            "properties": dict(SECRET_PROPS),
        }
        response = self.api_post("/v1/volume/targets", body, roles=MANAGER_ROLES)
        self.assertEqual(201, response.status_int)
        created = response.json["uuid"]
        stored = self.dbapi.get_volume_target_by_uuid(created)
        self.assertEqual(SECRET_PROPS["auth_password"],
                         stored["properties"]["auth_password"])
        self.assertEqual(SECRET_PROPS["target_iqn"],
                         stored["properties"]["target_iqn"])

    def test_permitted_caller_sees_ordinary_settings_in_create_response(self):
        body = {
            "node_uuid": self.node["uuid"],
            "volume_type": "iscsi",
            "boot_index": 12,
            "volume_id": "volume-created-3",
            "properties": dict(SECRET_PROPS),
        }
        response = self.api_post("/v1/volume/targets", body, roles=ADMIN_ROLES)
        self.assertEqual(201, response.status_int)
        self.assertIn(SECRET_PROPS["target_iqn"], response.text)
